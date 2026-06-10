export interface MqttBrokerConfig {
  name: string;
  type: string;
  websocketUrl: string;
  port: number;
  username: string;
  password?: string;
  clientId: string;
  baseTopic: string;
  isConnected: boolean;
  useRandomSuffix?: boolean;
}

export type ActiveTab = 
  | 'voice' 
  | 'suhu' 
  | 'kelembapan' 
  | 'mqtt-config' 
  | 'data-suhu' 
  | 'data-kelembapan' 
  | 'log-mqtt' 
  | 'kontrol-relay';

export interface RelayState {
  id: number;
  name: string;
  state: 'ON' | 'OFF';
}

export interface SensorDataLog {
  id: string;
  timestamp: string;
  broker: string;
  value: number;
}

export interface MqttLog {
  id: string;
  timestamp: string;
  type: 'info' | 'error' | 'publish' | 'subscribe' | 'command';
  broker: string;
  message: string;
}
