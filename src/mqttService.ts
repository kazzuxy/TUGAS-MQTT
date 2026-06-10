import mqtt, { MqttClient } from 'mqtt';
import { MqttBrokerConfig, MqttLog, SensorDataLog, RelayState } from './types';

const STORAGE_KEY = 'mqtt_broker_configurations';
const BASE_TOPIC_DEFAULT = 'gusliyanza/iot-multibroker';

const DEFAULT_BROKERS: MqttBrokerConfig[] = [
  {
    name: 'Shiftr.io',
    type: 'MQTT Broker 1',
    websocketUrl: 'wss://kazzuxy.cloud.shiftr.io',
    port: 443,
    username: 'kazzuxy',
    password: 'AsuCeleng',
    clientId: `web_shiftr_${Math.random().toString(36).substring(2, 7)}`,
    baseTopic: BASE_TOPIC_DEFAULT,
    isConnected: false
  },
  {
    name: 'Cedalo Cloud',
    type: 'MQTT Broker 2',
    websocketUrl: 'wss://pf-w6qyp6uiqe8pz7u9s7cg.cedalo.cloud/mqtt',
    port: 443,
    username: 'bass-web-client',
    password: 'AsuCeleng',
    clientId: 'bass-web-001',
    baseTopic: BASE_TOPIC_DEFAULT,
    isConnected: false,
    useRandomSuffix: true
  },
  {
    name: 'Flespi',
    type: 'MQTT Broker 3',
    websocketUrl: 'wss://mqtt.flespi.io:443',
    port: 443,
    username: 'kazzuxy',
    password: '',
    clientId: `web_flespi_${Math.random().toString(36).substring(2, 7)}`,
    baseTopic: BASE_TOPIC_DEFAULT,
    isConnected: false
  }
];

class MqttMultiBrokerManager {
  private brokers: MqttBrokerConfig[] = [];
  private clients: Map<string, MqttClient> = new Map();
  private onMessageCallback?: (topic: string, payload: string, brokerName: string) => void;
  private onStatusCallback?: (brokers: MqttBrokerConfig[]) => void;
  private logsCallback?: (log: MqttLog) => void;
  private telemetryInterval: any = null;

  constructor() {
    this.loadConfiguration();
  }

  private loadConfiguration() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.brokers = JSON.parse(saved);
        // Overwrite if older placeholders are detected (e.g. MyQttHub or ISI_ strings)
        const hasOld = this.brokers.some(b => b.name === 'MyQttHub' || b.username.includes('ISI_'));
        if (hasOld) {
          localStorage.removeItem(STORAGE_KEY);
          this.brokers = DEFAULT_BROKERS.map(b => ({ ...b }));
        } else {
          // Process connection status reset and ensure path auto-fixes
          this.brokers.forEach(b => {
            b.isConnected = false;
            if (b.name.toLowerCase().includes('cedalo') && !b.websocketUrl.endsWith('/mqtt')) {
              b.websocketUrl = b.websocketUrl.replace(/\/?$/, '/mqtt');
            }
            if (b.useRandomSuffix === undefined) {
              b.useRandomSuffix = b.name.toLowerCase().includes('cedalo');
            }
          });
        }
      } catch {
        this.brokers = DEFAULT_BROKERS.map(b => ({ ...b }));
      }
    } else {
      this.brokers = DEFAULT_BROKERS.map(b => ({ ...b }));
    }
  }

  public getBrokers(): MqttBrokerConfig[] {
    return this.brokers;
  }

  public saveConfiguration(configs: MqttBrokerConfig[]) {
    this.brokers = configs;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
    this.notifyStatus();
  }

  public resetConfiguration() {
    this.disconnectAll();
    this.brokers = DEFAULT_BROKERS.map(b => ({
      ...b
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.brokers));
    this.notifyStatus();
    this.addLog('info', 'System', 'Konfigurasi MQTT di-reset ke nilai default');
  }

  public registerCallbacks(
    onMessage: (topic: string, payload: string, brokerName: string) => void,
    onStatus: (brokers: MqttBrokerConfig[]) => void,
    onLog: (log: MqttLog) => void
  ) {
    this.onMessageCallback = onMessage;
    this.onStatusCallback = onStatus;
    this.logsCallback = onLog;
  }

  private addLog(type: MqttLog['type'], broker: string, message: string) {
    const log: MqttLog = {
      id: Math.random().toString(),
      timestamp: new Date().toISOString(),
      type,
      broker,
      message
    };
    if (this.logsCallback) {
      this.logsCallback(log);
    }
  }

  private notifyStatus() {
    if (this.onStatusCallback) {
      this.onStatusCallback([...this.brokers]);
    }
  }

  public connectAll() {
    this.addLog('info', 'System', 'Memulai koneksi ke semua MQTT Broker...');
    this.brokers.forEach(broker => {
      this.connectBroker(broker);
    });
    this.startSimulation();
  }

  public connectBroker(broker: MqttBrokerConfig) {
    // If already connected, disconnect first
    if (this.clients.has(broker.name)) {
      this.disconnectBroker(broker.name);
    }

    // Skip if it is a placeholder that hasn't been filled unless user test-connects
    const isPlaceholder = broker.websocketUrl.includes('ISI_WEBSOCKET') || broker.username.includes('ISI_USERNAME');
    if (isPlaceholder) {
      this.addLog('info', broker.name, `Menggunakan broker simulasi offline (URL / Kredensial placeholder).`);
      return;
    }

    // Ensure Cedalo broker uses /mqtt path if not specified
    let targetUrl = broker.websocketUrl;
    if (broker.name.toLowerCase().includes('cedalo') && !targetUrl.endsWith('/mqtt')) {
      targetUrl = targetUrl.replace(/\/?$/, '/mqtt');
    }

    try {
      const actualClientId = broker.useRandomSuffix 
        ? `${broker.clientId}_${Math.random().toString(36).substring(2, 6)}`
        : broker.clientId;

      this.addLog('info', broker.name, `Menghubungkan ke ${targetUrl}:${broker.port} (ID: ${actualClientId})...`);
      
      const options: any = {
        clientId: actualClientId,
        username: broker.username.includes('ISI_') ? undefined : broker.username,
        password: broker.password?.includes('ISI_') ? undefined : broker.password,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 5000,
        keepalive: 30
      };

      const client = mqtt.connect(targetUrl, options);
      this.clients.set(broker.name, client);

      client.on('connect', () => {
        broker.isConnected = true;
        this.addLog('info', broker.name, 'Koneksi Berhasil terjalin!');
        this.notifyStatus();

        // Subscribe to relevant topics
        const topics = [
          `${broker.baseTopic}/sensor`,
          `${broker.baseTopic}/relay/+/state`,
          `${broker.baseTopic}/mode/set`,
          `${broker.baseTopic}/voice/cmd`,
          `${broker.baseTopic}/log`
        ];
        
        topics.forEach(topic => {
          client.subscribe(topic, (err) => {
            if (!err) {
              this.addLog('subscribe', broker.name, `Berlangganan ke topik: ${topic}`);
            } else {
              this.addLog('error', broker.name, `Gagal berlangganan ke topik: ${topic}. Error: ${err.message}`);
            }
          });
        });
      });

      client.on('message', (topic, message) => {
        const payloadStr = message.toString();
        this.addLog('subscribe', broker.name, `Pesan Diterima [${topic}]: ${payloadStr}`);
        if (this.onMessageCallback) {
          this.onMessageCallback(topic, payloadStr, broker.name);
        }
      });

      client.on('error', (err) => {
        this.addLog('error', broker.name, `Koneksi Error: ${err.message}`);
        broker.isConnected = false;
        this.notifyStatus();
      });

      client.on('close', () => {
        if (broker.isConnected) {
          this.addLog('error', broker.name, `Koneksi Terputus`);
          broker.isConnected = false;
          this.notifyStatus();
        }
      });

    } catch (error: any) {
      this.addLog('error', broker.name, `Gagal menghubungkan: ${error?.message || error}`);
      broker.isConnected = false;
      this.notifyStatus();
    }
  }

  public disconnectBroker(name: string) {
    const client = this.clients.get(name);
    if (client) {
      client.end();
      this.clients.delete(name);
      
      const broker = this.brokers.find(b => b.name === name);
      if (broker) {
        broker.isConnected = false;
        this.addLog('info', name, 'Koneksi dinonaktifkan oleh pengguna');
      }
      this.notifyStatus();
    }
  }

  public testConnection(broker: MqttBrokerConfig): Promise<boolean> {
    return new Promise((resolve) => {
      // Ensure Cedalo broker uses /mqtt path if not specified
      let targetUrl = broker.websocketUrl;
      if (broker.name.toLowerCase().includes('cedalo') && !targetUrl.endsWith('/mqtt')) {
        targetUrl = targetUrl.replace(/\/?$/, '/mqtt');
      }

      this.addLog('info', broker.name, `Mencoba melakukan tes koneksi ke ${targetUrl}...`);
      
      const testClientId = broker.useRandomSuffix
        ? `${broker.clientId}_test_${Math.random().toString(36).substring(2, 6)}`
        : `${broker.clientId}_test`;

      const options: any = {
        clientId: testClientId,
        username: broker.username.includes('ISI_') ? undefined : broker.username,
        password: broker.password?.includes('ISI_') ? undefined : broker.password,
        clean: true,
        connectTimeout: 4000,
        keepalive: 30
      };

      const testClient = mqtt.connect(targetUrl, options);
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.addLog('error', broker.name, 'Tes koneksi gagal: Timeout (4000ms)');
          testClient.end(true);
          resolve(false);
        }
      }, 4000);

      testClient.on('connect', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          this.addLog('info', broker.name, 'Tes koneksi BERHASIL!');
          testClient.end(true);
          resolve(true);
        }
      });

      testClient.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          this.addLog('error', broker.name, `Tes koneksi gagal: ${err.message}`);
          testClient.end(true);
          resolve(false);
        }
      });
    });
  }

  public publishToAll(topic: string, payload: string) {
    this.addLog('publish', 'All Brokers', `Publishing to [${topic}]: ${payload}`);
    
    // Publish to all active connected clients
    let publishCount = 0;
    this.clients.forEach((client, brokerName) => {
      if (client.connected) {
        client.publish(topic, payload, { qos: 1 });
        this.addLog('publish', brokerName, `Berhasil publish ke [${topic}]`);
        publishCount++;
      }
    });

    // If no client is active, handle it locally
    if (publishCount === 0) {
      this.addLog('info', 'Simulation', `Offline: Perintah dikoordinasikan secara offline`);
    }

    // Echo immediately to local UI handler via callback to support immediate response
    if (this.onMessageCallback) {
      this.onMessageCallback(topic, payload, 'Local Simulator');
    }
  }

  public disconnectAll() {
    this.addLog('info', 'System', 'Mematikan semua koneksi MQTT');
    this.brokers.forEach(broker => {
      this.disconnectBroker(broker.name);
    });
    this.stopSimulation();
  }

  // Background simulation for offline demonstration
  private startSimulation() {
    if (this.telemetryInterval) return;

    this.telemetryInterval = setInterval(() => {
      // Periodic sensor updates
      const t = parseFloat((23.0 + Math.random() * 14.0).toFixed(1)); // Temperature between 23 and 37 Celsius
      const h = parseFloat((35.0 + Math.random() * 45.0).toFixed(1)); // Humidity between 35 and 80 percent
      
      const payload = {
        temperature: t,
        humidity: h,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };

      const payloadStr = JSON.stringify(payload);
      
      // Send simulation reads to our message handler if no real broker provides it
      const anyRealConnected = Array.from(this.clients.values()).some(client => client.connected);
      if (!anyRealConnected && this.onMessageCallback) {
        const selectedBroker = this.brokers[Math.floor(Math.random() * this.brokers.length)].name;
        this.onMessageCallback(`${BASE_TOPIC_DEFAULT}/sensor`, payloadStr, `${selectedBroker} (Simulasi)`);
      }
    }, 8000); 
  }

  private stopSimulation() {
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
      this.telemetryInterval = null;
    }
  }
}

export const MqttManager = new MqttMultiBrokerManager();
export default MqttManager;
