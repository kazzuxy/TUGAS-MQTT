import React, { useState, useEffect, useRef } from 'react';
import { listenToAuth, logoutUser, isAuthMocked } from './firebase';
import { MqttBrokerConfig, ActiveTab, RelayState, SensorDataLog, MqttLog } from './types';
import MqttManager from './mqttService';
import { 
  TemperatureVisualizer, 
  HumidityVisualizer, 
  VoiceSpectrumVisualizer 
} from './components/ThreeVisualizer';
import { LoginForm } from './components/LoginForm';
import { Topbar, Sidebar } from './components/Navigation';
import { 
  Radio, Thermometer, Droplets, Sliders, Settings2, FileText, 
  Trash2, Play, Square, Volume2, Mic, CheckCircle, XCircle, RefreshCw, Layers, ShieldAlert, Zap
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Dashboard states
  const [activeTab, setActiveTab] = useState<ActiveTab>('voice');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [brokers, setBrokers] = useState<MqttBrokerConfig[]>([]);

  // Sensory values
  const [temperature, setTemperature] = useState<number>(28.5);
  const [humidity, setHumidity] = useState<number>(55.0);

  // 4 Relays States
  const [relays, setRelays] = useState<RelayState[]>([
    { id: 1, name: 'Relay 1 (Lampu Utama)', state: 'OFF' },
    { id: 2, name: 'Relay 2 (Sirkulasi Fan)', state: 'OFF' },
    { id: 3, name: 'Relay 3 (Water Pump)', state: 'OFF' },
    { id: 4, name: 'Relay 4 (Alarm Sirine)', state: 'OFF' },
  ]);

  // Logs & Tables cache
  const [suhuLogs, setSuhuLogs] = useState<SensorDataLog[]>([]);
  const [lembapLogs, setLembapLogs] = useState<SensorDataLog[]>([]);
  const [mqttLogs, setMqttLogs] = useState<MqttLog[]>([]);

  // Speech/Voice Recognition
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voicePromptActive, setVoicePromptActive] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Configuration forms
  const [configBrokerIndex, setConfigBrokerIndex] = useState<number>(0);
  const [formUrls, setFormUrls] = useState<string[]>([]);
  const [formPorts, setFormPorts] = useState<number[]>([]);
  const [formUsernames, setFormUsernames] = useState<string[]>([]);
  const [formPasswords, setFormPasswords] = useState<string[]>([]);
  const [formClientIds, setFormClientIds] = useState<string[]>([]);
  const [formBaseTopics, setFormBaseTopics] = useState<string[]>([]);
  const [formUseRandomSuffix, setFormUseRandomSuffix] = useState<boolean[]>([]);
  const [testResults, setTestResults] = useState<{ [key: string]: 'success' | 'failed' | 'testing' | null }>({});

  // Beep Audio indicator helper
  const playBeep = (frequency = 800, duration = 0.08) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  // Speaks using Text to Speech
  const speakVoice = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel vocal queues first
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      
      // Try to find an Indonesian voice if available
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(v => v.lang.includes('id'));
      if (idVoice) utterance.voice = idVoice;
      
      window.speechSynthesis.speak(utterance);
    }
  };

  // Authentication observer hook
  useEffect(() => {
    const unsubscribe = listenToAuth((currUser) => {
      setUser(currUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Initialize cached data and broker configurations
  useEffect(() => {
    if (!user) return;

    // Load static logs
    const cachedSuhu = localStorage.getItem('sensor_suhu_logs');
    if (cachedSuhu) setSuhuLogs(JSON.parse(cachedSuhu));

    const cachedLembap = localStorage.getItem('sensor_lembap_logs');
    if (cachedLembap) setLembapLogs(JSON.parse(cachedLembap));

    const cachedLogs = localStorage.getItem('mqtt_events_logs');
    if (cachedLogs) setMqttLogs(JSON.parse(cachedLogs));

    // Fill form placeholders
    const currentBrokers = MqttManager.getBrokers();
    setBrokers(currentBrokers);
    setFormUrls(currentBrokers.map(b => b.websocketUrl));
    setFormPorts(currentBrokers.map(b => b.port));
    setFormUsernames(currentBrokers.map(b => b.username));
    setFormPasswords(currentBrokers.map(b => b.password || ''));
    setFormClientIds(currentBrokers.map(b => b.clientId));
    setFormBaseTopics(currentBrokers.map(b => b.baseTopic));
    setFormUseRandomSuffix(currentBrokers.map(b => !!b.useRandomSuffix));

    // Register active callbacks with the Multi-Broker client manager
    MqttManager.registerCallbacks(
      // 1. Packet message parsing callback
      (topic, payload, brokerName) => {
        handleMqttIncomingMessage(topic, payload, brokerName);
      },
      // 2. Connector state status update callback
      (updatedBrokers) => {
        setBrokers(updatedBrokers);
      },
      // 3. Activity logger callback
      (log) => {
        setMqttLogs(prev => {
          const updated = [log, ...prev].slice(0, 150); // limit to a compact circular 150 entries
          localStorage.setItem('mqtt_events_logs', JSON.stringify(updated));
          return updated;
        });
      }
    );

    // Initial boot trigger
    MqttManager.connectAll();

    // Auto-adjust layout on smaller viewports initially
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }

    return () => {
      MqttManager.disconnectAll();
    };
  }, [user]);

  // Handle Incoming MQTT events and state translations
  const handleMqttIncomingMessage = (topic: string, payload: string, brokerName: string) => {
    const timestampStr = new Date().toISOString();

    // Check 1: DHT11 Sensor telemetry parsing (Standard JSON Payload)
    if (topic.endsWith('/sensor')) {
      try {
        const data = JSON.parse(payload);
        const tempVal = parseFloat(data.temperature);
        const humVal = parseFloat(data.humidity);

        if (!isNaN(tempVal)) {
          setTemperature(tempVal);
          setSuhuLogs(prev => {
            const next = [{ 
              id: Math.random().toString(), 
              timestamp: timestampStr, 
              broker: brokerName, 
              value: tempVal 
            }, ...prev].slice(0, 50);
            localStorage.setItem('sensor_suhu_logs', JSON.stringify(next));
            return next;
          });
        }

        if (!isNaN(humVal)) {
          setHumidity(humVal);
          setLembapLogs(prev => {
            const next = [{
              id: Math.random().toString(), 
              timestamp: timestampStr, 
              broker: brokerName, 
              value: humVal
            }, ...prev].slice(0, 50);
            localStorage.setItem('sensor_lembap_logs', JSON.stringify(next));
            return next;
          });
        }
      } catch (err) {
        // Fallback: If payload is simple raw numbers rather than json string
        const rawNum = parseFloat(payload);
        if (!isNaN(rawNum)) {
          setTemperature(rawNum);
        }
      }
    }

    // Check 2: Relay state tracking from topics /relay/+/state
    const relayStateMatch = topic.match(/\/relay\/(\d)\/state/);
    if (relayStateMatch) {
      const relayId = parseInt(relayStateMatch[1]);
      const statusValue = payload.toUpperCase();
      if (statusValue === 'ON' || statusValue === 'OFF') {
        setRelays(prev => 
          prev.map(r => r.id === relayId ? { ...r, state: statusValue } : r)
        );
      }
    }

    // Capture explicit simulated Voice command actions Echoed from other brokers
    if (topic.endsWith('/voice/cmd')) {
      // Just showing visual trigger notification
      setVoicePromptActive(true);
      setTimeout(() => setVoicePromptActive(false), 1500);
    }
  };

  // Publish controls
  const handleRelayToggleInService = (relayId: number, targetState: 'ON' | 'OFF') => {
    playBeep(900, 0.05);

    // Topic format: gusliyanza/iot-multibroker/relay/1/set
    const baseTopicUsed = brokers[0]?.baseTopic || 'gusliyanza/iot-multibroker';
    const topic = `${baseTopicUsed}/relay/${relayId}/set`;
    MqttManager.publishToAll(topic, targetState);

    // Optimistic fallback: simulate state topic back immediately in case broker has no echo script
    const stateTopic = `${baseTopicUsed}/relay/${relayId}/state`;
    setTimeout(() => {
      handleMqttIncomingMessage(stateTopic, targetState, 'Local Echo');
    }, 150);
  };

  const handleTurnAllRelays = (targetState: 'ON' | 'OFF') => {
    playBeep(1000, 0.1);
    const baseTopicUsed = brokers[0]?.baseTopic || 'gusliyanza/iot-multibroker';
    
    // Broadcast setting to all 4 relays
    [1, 2, 3, 4].forEach(id => {
      const topic = `${baseTopicUsed}/relay/${id}/set`;
      MqttManager.publishToAll(topic, targetState);
      
      const stateTopic = `${baseTopicUsed}/relay/${id}/state`;
      setTimeout(() => {
        handleMqttIncomingMessage(stateTopic, targetState, 'Local Echo');
      }, 100 + id * 50);
    });
  };

  // VARIATION 1: Individual Sequential activation
  const handleVariation1 = async () => {
    playBeep(600, 0.08);
    const baseTopicUsed = brokers[0]?.baseTopic || 'gusliyanza/iot-multibroker';
    
    // Publish VARIASI1 payload to mode topic: mode/set
    MqttManager.publishToAll(`${baseTopicUsed}/mode/set`, 'VARIASI1');

    // Visually cycle activation locally to display impressive feedback
    handleTurnAllRelays('OFF');

    for (let id = 1; id <= 4; id++) {
      await new Promise(res => setTimeout(res, 800));
      handleRelayToggleInService(id, 'ON');
    }
  };

  // VARIATION 2: Synchronous Strobe flash effect
  const handleVariation2 = async () => {
    playBeep(1200, 0.05);
    const baseTopicUsed = brokers[0]?.baseTopic || 'gusliyanza/iot-multibroker';
    MqttManager.publishToAll(`${baseTopicUsed}/mode/set`, 'VARIASI2');

    // Double flash strobe sequence
    for (let strobe = 0; strobe < 3; strobe++) {
      handleTurnAllRelays('ON');
      await new Promise(res => setTimeout(res, 400));
      handleTurnAllRelays('OFF');
      await new Promise(res => setTimeout(res, 400));
    }
  };

  // SPEECH RECOGNITION (id-ID) ENGINE INITIALIZATION
  const startVoiceListening = () => {
    setErrorText(null);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Browser ini tidak mendukung Web Speech API. Silakan gunakan Google Chrome.");
      return;
    }

    try {
      playBeep(1000, 0.15);
      const rec = new SpeechRecognition();
      rec.lang = 'id-ID';
      rec.continuous = false;
      rec.interimResults = false;

      rec.onstart = () => {
        setIsListening(true);
        setVoiceTranscript('Mendengarkan suara Anda...');
      };

      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript.toLowerCase();
        setVoiceTranscript(text);
        processVoiceCommand(text);
      };

      rec.onerror = (e: any) => {
        console.error("Speech Error:", e);
        setVoiceTranscript(`Koneksi audio terputus: ${e.error}`);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err: any) {
      console.error(err);
      setIsListening(false);
    }
  };

  const stopVoiceListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      playBeep(500, 0.1);
      setIsListening(false);
    }
  };

  const [errorText, setErrorText] = useState<string | null>(null);

  // Parse vocal spoken commands
  const processVoiceCommand = (text: string) => {
    const baseTopicUsed = brokers[0]?.baseTopic || 'gusliyanza/iot-multibroker';
    
    // Publish raw transcription to voice topic first
    MqttManager.publishToAll(`${baseTopicUsed}/voice/cmd`, text);

    // Commands Matcher patterns (Indonesian)
    // Relay 1 Commands
    if (text.includes('nyalakan relay 1') || text.includes('hidupkan relay 1') || text.includes('nyalakan lampu 1') || text.includes('nyalakan saklar 1')) {
      handleRelayToggleInService(1, 'ON');
      speakVoice('Menyalakan relay 1 sesuai perintah');
    } else if (text.includes('matikan relay 1') || text.includes('padamkan relay 1') || text.includes('matikan lampu 1') || text.includes('matikan saklar 1')) {
      handleRelayToggleInService(1, 'OFF');
      speakVoice('Mematikan relay 1 sesuai perintah');
    }
    // Relay 2 Commands
    else if (text.includes('nyalakan relay 2') || text.includes('hidupkan relay 2') || text.includes('nyalakan lampu 2') || text.includes('nyalakan fan') || text.includes('nyalakan kipas')) {
      handleRelayToggleInService(2, 'ON');
      speakVoice('Menyalakan sirkulasi fan relay 2');
    } else if (text.includes('matikan relay 2') || text.includes('padamkan relay 2') || text.includes('matikan kipas') || text.includes('matikan fan')) {
      handleRelayToggleInService(2, 'OFF');
      speakVoice('Mematikan kipas angin relay 2');
    }
    // Relay 3 Commands
    else if (text.includes('nyalakan relay 3') || text.includes('hidupkan relay 3') || text.includes('nyalakan pompa')) {
      handleRelayToggleInService(3, 'ON');
      speakVoice('Menyalakan pompa air relay 3');
    } else if (text.includes('matikan relay 3') || text.includes('matikan pompa')) {
      handleRelayToggleInService(3, 'OFF');
      speakVoice('Mematikan pompa air relay 3');
    }
    // Relay 4 Commands
    else if (text.includes('nyalakan relay 4') || text.includes('hidupkan relay 4') || text.includes('nyalakan alarm') || text.includes('nyalakan sirine')) {
      handleRelayToggleInService(4, 'ON');
      speakVoice('Menyalakan alarm sirine relay 4');
    } else if (text.includes('matikan relay 4') || text.includes('matikan alarm') || text.includes('matikan sirine')) {
      handleRelayToggleInService(4, 'OFF');
      speakVoice('Mematikan sirine relay 4');
    }
    // ALL Relays
    else if (text.includes('nyalakan semua') || text.includes('hidupkan semua') || text.includes('nyalakan semua relay')) {
      handleTurnAllRelays('ON');
      speakVoice('Menyalakan seluruh relay sistem');
    } else if (text.includes('matikan semua') || text.includes('padamkan semua') || text.includes('matikan semua relay')) {
      handleTurnAllRelays('OFF');
      speakVoice('Mematikan seluruh relay sistem');
    }
    // Variations
    else if (text.includes('jalankan variasi 1') || text.includes('variasi satu') || text.includes('nyalakan variasi 1')) {
      handleVariation1();
      speakVoice('Memulai simulasi variasi satu, relay menyala berurutan');
    } else if (text.includes('jalankan variasi 2') || text.includes('variasi dua') || text.includes('nyalakan variasi 2')) {
      handleVariation2();
      speakVoice('Memulai strobe efek variasi dua');
    }
    // Readings
    else if (text.includes('baca suhu') || text.includes('berapakah suhu') || text.includes('cek suhu')) {
      speakVoice(`Suhu ruangan saat ini adalah ${temperature} derajat Celsius.`);
    } else if (text.includes('baca kelembaban') || text.includes('baca kelembapan') || text.includes('cek kelembaban')) {
      speakVoice(`Kelembapar ruangan saat ini adalah ${humidity} persen.`);
    } else {
      // Unrecognized Command feedback
      playBeep(400, 0.2);
    }
  };

  // Subform Configuration handlers
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    playBeep(850, 0.08);

    const updatedBrokers = [...brokers];
    updatedBrokers[configBrokerIndex] = {
      ...updatedBrokers[configBrokerIndex],
      websocketUrl: formUrls[configBrokerIndex],
      port: formPorts[configBrokerIndex],
      username: formUsernames[configBrokerIndex],
      password: formPasswords[configBrokerIndex],
      clientId: formClientIds[configBrokerIndex],
      baseTopic: formBaseTopics[configBrokerIndex],
      useRandomSuffix: formUseRandomSuffix[configBrokerIndex]
    };

    MqttManager.saveConfiguration(updatedBrokers);
    MqttManager.connectBroker(updatedBrokers[configBrokerIndex]);
    alert(`Konfigurasi Broker ${updatedBrokers[configBrokerIndex].name} berhasil disimpan dan dimuat!`);
  };

  const handleTestBrokerConnection = async (idx: number) => {
    playBeep(1100, 0.05);
    const brokerToTest = brokers[idx];
    const testConfig: typeof brokerToTest = {
      ...brokerToTest,
      websocketUrl: formUrls[idx],
      port: formPorts[idx],
      username: formUsernames[idx],
      password: formPasswords[idx],
      clientId: formClientIds[idx],
      baseTopic: formBaseTopics[idx],
      useRandomSuffix: formUseRandomSuffix[idx],
      isConnected: false
    };

    setTestResults(prev => ({ ...prev, [brokerToTest.name]: 'testing' }));
    const result = await MqttManager.testConnection(testConfig);
    setTestResults(prev => ({ ...prev, [brokerToTest.name]: result ? 'success' : 'failed' }));
  };

  const handleResetAllConfigs = () => {
    const confirm = window.confirm("Reset seluruh konfigurasi broker MQTT ke nilai default?");
    if (confirm) {
      MqttManager.resetConfiguration();
      const resetBrokers = MqttManager.getBrokers();
      setBrokers(resetBrokers);
      setFormUrls(resetBrokers.map(b => b.websocketUrl));
      setFormPorts(resetBrokers.map(b => b.port));
      setFormUsernames(resetBrokers.map(b => b.username));
      setFormPasswords(resetBrokers.map(b => b.password || ''));
      setFormClientIds(resetBrokers.map(b => b.clientId));
      setFormBaseTopics(resetBrokers.map(b => b.baseTopic));
      setFormUseRandomSuffix(resetBrokers.map(b => !!b.useRandomSuffix));
      setTestResults({});
      MqttManager.connectAll();
    }
  };

  // Clear log local storage cached tables
  const handleClearSuhuLogs = () => {
    setSuhuLogs([]);
    localStorage.removeItem('sensor_suhu_logs');
  };

  const handleClearLembapLogs = () => {
    setLembapLogs([]);
    localStorage.removeItem('sensor_lembap_logs');
  };

  const handleClearMqttLogs = () => {
    setMqttLogs([]);
    localStorage.removeItem('mqtt_events_logs');
  };

  const handleLogout = async () => {
    const yes = window.confirm("Apakah anda yakin ingin keluar sistem?");
    if (yes) {
      await logoutUser();
      setUser(null);
    }
  };

  // Auth Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#090d16] text-white font-sans">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="mt-4 text-xs font-mono tracking-widest text-slate-500 uppercase">Mengautentikasi sesi...</p>
      </div>
    );
  }

  // Auth Guard: Unauthenticated user renders Login
  if (!user) {
    return <LoginForm onLoginSuccess={setUser} />;
  }

  // Authenticated Dashboard Layout
  return (
    <div className="min-h-screen bg-[#070a13] text-[#f1f5f9] font-sans flex flex-col antialiased">
      <div className="flex flex-1 relative overflow-hidden">
        
        {/* Dynamic Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          user={user}
          brokers={brokers}
          onLogout={handleLogout}
        />

        {/* Content Panel Frame */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          
          <Topbar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            user={user}
            brokers={brokers}
            onLogout={handleLogout}
          />

          {/* Tab Views Content Area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
            
            {/* Quick telemetry indicators ticker bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="bento-ticker">
              <div className="bg-[#111827]/60 backdrop-blur-sm border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Suhu Terakhir</p>
                  <p className="text-xl font-bold font-mono text-emerald-400 mt-1">{temperature}°C</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <Thermometer className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-[#111827]/60 backdrop-blur-sm border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Kelembapan</p>
                  <p className="text-xl font-bold font-mono text-cyan-400 mt-1">{humidity}%</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                  <Droplets className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-[#111827]/60 backdrop-blur-sm border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Relay Aktif</p>
                  <p className="text-xl font-bold font-mono text-blue-400 mt-1">
                    {relays.filter(r => r.state === 'ON').length} / 4 ON
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                  <Sliders className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-[#111827]/60 backdrop-blur-sm border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Total Broker</p>
                  <p className="text-xl font-bold font-mono text-indigo-400 mt-1">
                    {brokers.filter(b => b.isConnected).length} OK
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <RefreshCw className="w-5 h-5 hover:rotate-180 transition-transform duration-500" />
                </div>
              </div>
            </div>

            {/* TAB VIEWPORTS */}
            
            {/* 1. VOICE COMMAND TAB */}
            {activeTab === 'voice' && (
              <div className="space-y-6" id="view-voice">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <Radio className="w-5 h-5 text-sky-400 animate-pulse" />
                      Perintah Suara IoT
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 leading-normal font-sans">
                      Berikan kontrol handsfree ke sistem sensor via Web Speech API (Mendukung instruksi Bahasa Indonesia id-ID).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Visual spectrum left */}
                  <div className="lg:col-span-8 space-y-6">
                    <div className="bg-[#111827]/50 border border-slate-800 px-5 py-6 rounded-2xl relative">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-4 font-bold flex items-center gap-2">
                        <span>Aktivitas Frekuensi Spektrum 3D</span>
                      </h4>
                      
                      <VoiceSpectrumVisualizer isListening={isListening} />

                      {/* Transcribed Text Display */}
                      <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
                        <span className="text-[10px] font-mono uppercase text-sky-400 font-bold tracking-wider block">Hasil Pengenalan Suara:</span>
                        <p className="text-sm md:text-base font-medium mt-1 text-slate-200">
                          {voiceTranscript || 'Mulai mendengarkan untuk memproses perintah suara...'}
                        </p>
                      </div>

                      <div className="flex gap-4 items-center mt-6">
                        {!isListening ? (
                          <button
                            id="btn-voice-start"
                            onClick={startVoiceListening}
                            className="bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center gap-2 px-5 py-3 rounded-xl transition-all shadow-lg hover:shadow-sky-500/20 text-sm cursor-pointer"
                          >
                            <Mic className="w-4 h-4" />
                            <span>Mulai Mendengarkan</span>
                          </button>
                        ) : (
                          <button
                            id="btn-voice-stop"
                            onClick={stopVoiceListening}
                            className="bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center gap-2 px-5 py-3 rounded-xl transition-all shadow-lg hover:shadow-red-600/20 text-sm cursor-pointer"
                          >
                            <Square className="w-4 h-4 shrink-0" />
                            <span>Berhenti Mendengarkan</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cheat sheet dictionary right */}
                  <div className="lg:col-span-4 bg-[#111827]/40 border border-slate-800/80 rounded-2xl p-5 font-sans space-y-4">
                    <div>
                      <h4 className="text-xs font-mono uppercase tracking-widest text-[#a5b4fc] font-bold">Kamus Perintah Suara</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Ucapkan frasa berikut setelah menekan tombol mulai:</p>
                    </div>

                    <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                      <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/50">
                        <span className="text-[10px] font-mono uppercase text-sky-400 font-bold tracking-wider">Perintah Saklar Relay:</span>
                        <ul className="text-xs text-slate-300 mt-1.5 space-y-1.5 list-disc pl-4 font-sans">
                          <li><code className="text-blue-300 font-mono font-bold">"nyalakan relay [1-4]"</code></li>
                          <li><code className="text-blue-300 font-mono font-bold">"matikan relay [1-4]"</code></li>
                          <li><code className="text-blue-300 font-mono font-bold">"nyalakan semua relay"</code></li>
                          <li><code className="text-blue-300 font-mono font-bold">"matikan semua relay"</code></li>
                        </ul>
                      </div>

                      <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/50">
                        <span className="text-[10px] font-mono uppercase text-sky-400 font-bold tracking-wider">Perintah Variasi Mode:</span>
                        <ul className="text-xs text-slate-300 mt-1.5 space-y-1.5 list-disc pl-4 font-sans">
                          <li><code className="text-violet-300 font-mono font-bold">"jalankan variasi 1"</code></li>
                          <li><code className="text-violet-300 font-mono font-bold">"jalankan variasi 2"</code></li>
                        </ul>
                      </div>

                      <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/50">
                        <span className="text-[10px] font-mono uppercase text-sky-400 font-bold tracking-wider">Perintah Pembacaan Lisan (TTS):</span>
                        <ul className="text-xs text-slate-300 mt-1.5 space-y-1.5 list-disc pl-4 font-sans">
                          <li><code className="text-emerald-300 font-mono font-bold">"baca suhu"</code> / Cek termometer</li>
                          <li><code className="text-emerald-300 font-mono font-bold">"baca kelembapan"</code></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. TEMPERATURE (SUHU) GRAPHIC TAB */}
            {activeTab === 'suhu' && (
              <div className="space-y-6" id="view-suhu">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Thermometer className="w-5 h-5 text-emerald-400" />
                    Visual Emoticon 3D Suhu (DHT)
                  </h1>
                  <p className="text-xs text-slate-400 mt-1 font-sans">
                    Mengamati perubahan ekspresi dan akselerasi kinetik emoticon 100% WebGL Three.js sesuai sensor suhu aktual.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Canvas container */}
                  <div className="md:col-span-8">
                    <TemperatureVisualizer temperature={temperature} />
                  </div>

                  {/* Digital Meter right */}
                  <div className="md:col-span-4 bg-[#111827]/40 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between font-sans">
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-[#a5b4fc] block font-bold leading-none">Sensor Value</span>
                      <p className="text-5xl font-mono font-extrabold text-emerald-400 tracking-tight mt-2">{temperature}°C</p>
                      
                      <div className="mt-5 space-y-2 text-xs">
                        <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                          <span className="text-slate-400">Parameter:</span>
                          <span className="text-slate-200 font-medium font-mono">Celcius</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                          <span className="text-slate-400">Status Termal:</span>
                          <span className={`font-bold font-sans ${
                            temperature < 25 ? 'text-blue-400' :
                            temperature <= 30 ? 'text-emerald-400' :
                            temperature <= 35 ? 'text-orange-400' : 'text-red-400'
                          }`}>
                            {temperature < 25 ? 'Dingin' :
                             temperature <= 30 ? 'Normal' :
                             temperature <= 35 ? 'Panas' : 'Sangat Panas'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-slate-400">Animasi 3D:</span>
                          <span className="text-slate-200 font-mono">
                            {temperature < 25 ? 'Bergetar Pelan (Slow)' :
                             temperature <= 30 ? 'Berputar Stabil' :
                             temperature <= 35 ? 'Putaran Cepat' : 'Getar Strobe Cepat'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-slate-800/50 flex flex-col gap-3">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Uji Simulasi Cepat:</span>
                      <div className="grid grid-cols-4 gap-2">
                        {[20, 28, 33, 38].map((v) => (
                          <button
                            key={v}
                            onClick={() => {
                              playBeep(700, 0.05);
                              setTemperature(v);
                            }}
                            className={`py-1 rounded text-[11px] font-mono border transition-all ${
                              temperature === v 
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold' 
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {v}°C
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. HUMIDITY (KELEMBAPAN) GRAPHIC TAB */}
            {activeTab === 'kelembapan' && (
              <div className="space-y-6" id="view-kelembapan">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-cyan-400" />
                    Visual Emoticon 3D Kelembapan
                  </h1>
                  <p className="text-xs text-slate-400 mt-1 font-sans">
                    Mengamati adaptasi bobbing, emisi uap, dan tingkat kelengketan material droplet 3D sesuai sensory kelembapan persen.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Canvas container */}
                  <div className="md:col-span-8">
                    <HumidityVisualizer humidity={humidity} />
                  </div>

                  {/* Digital Meter right */}
                  <div className="md:col-span-4 bg-[#111827]/40 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between font-sans">
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-[#a5b4fc] block font-bold leading-none">Sensor Moisture</span>
                      <p className="text-5xl font-mono font-extrabold text-cyan-400 tracking-tight mt-2">{humidity}%</p>
                      
                      <div className="mt-5 space-y-2 text-xs">
                        <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                          <span className="text-slate-400">Parameter:</span>
                          <span className="text-slate-200 font-medium font-mono">Relative Humidity (RH)</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                          <span className="text-slate-400">Kondisi Udara:</span>
                          <span className={`font-bold font-sans ${
                            humidity < 40 ? 'text-yellow-400' :
                            humidity <= 70 ? 'text-emerald-400' : 'text-cyan-400'
                          }`}>
                            {humidity < 40 ? 'Kering / Gersang' :
                             humidity <= 70 ? 'Optimal / Nyaman' : 'Lembap / Basah'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-slate-400">Dinamika Fisika:</span>
                          <span className="text-slate-200 font-mono">
                            {humidity < 40 ? 'Bobbing Lambat' :
                             humidity <= 70 ? 'Suspensi Stabil' : 'Bobbing & Partikel Menguap'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-slate-800/50 flex flex-col gap-3">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Uji Simulasi Cepat:</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[30, 55, 80].map((v) => (
                          <button
                            key={v}
                            onClick={() => {
                              playBeep(700, 0.05);
                              setHumidity(v);
                            }}
                            className={`py-1 rounded text-[11px] font-mono border transition-all ${
                              humidity === v 
                                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-bold' 
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {v}% RH
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. KONTROL RELAY TAB */}
            {activeTab === 'kontrol-relay' && (
              <div className="space-y-6" id="view-kontrol">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-blue-400" />
                      Aktuator Kendali Relay
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-sans">
                      Tombol perintah dialirkan ke 3 MQTT broker sekaligus secara paralel. Status diumpan balik dari topic MQTT state.
                    </p>
                  </div>

                  {/* Mass triggers */}
                  <div className="flex gap-2.5 shrink-0 self-start">
                    <button
                      id="btn-all-on"
                      onClick={() => handleTurnAllRelays('ON')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                    >
                      Nyalakan Semua
                    </button>
                    <button
                      id="btn-all-off"
                      onClick={() => handleTurnAllRelays('OFF')}
                      className="bg-slate-800 hover:bg-slate-700 hover:text-red-400 text-slate-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border border-slate-700/80 transition-all"
                    >
                      Matikan Semua
                    </button>
                  </div>
                </div>

                {/* Grid of 4 Relays cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="relay-cards-grid">
                  {relays.map((relay) => {
                    const isON = relay.state === 'ON';
                    return (
                      <div
                        key={relay.id}
                        id={`relay-card-${relay.id}`}
                        className={`p-5 rounded-2xl border transition-all h-[155px] flex flex-col justify-between ${
                          isON 
                            ? 'bg-blue-600/10 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                            : 'bg-[#111827]/40 border-slate-800/80 hover:border-slate-705/80'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold">Relay {relay.id}</span>
                            <h4 className="text-sm font-semibold text-white mt-0.5">{relay.name}</h4>
                          </div>
                          <span className={`w-2.5 h-2.5 rounded-full ${isON ? 'bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-slate-700'}`} />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-mono font-extrabold ${isON ? 'text-blue-400' : 'text-slate-500'}`}>
                            {isON ? 'AKTIF (ON)' : 'MATI (OFF)'}
                          </span>
                          <div className="flex gap-1.5 bg-slate-950/70 p-1 rounded-lg border border-slate-800/80">
                            <button
                              id={`relay-${relay.id}-on`}
                              onClick={() => handleRelayToggleInService(relay.id, 'ON')}
                              className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                                isON 
                                  ? 'bg-blue-600 text-white' 
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              ON
                            </button>
                            <button
                              id={`relay-${relay.id}-off`}
                              onClick={() => handleRelayToggleInService(relay.id, 'OFF')}
                              className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer transition-all ${
                                !isON 
                                  ? 'bg-slate-800 text-white' 
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              OFF
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Special Automation variations panel */}
                <div className="bg-[#111827]/30 border border-slate-800/80 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wide">Variasi & Otomasi Sekuensial</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Uji coba algoritme rangkaian kendali terprogram dengan umpan balik cepat.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Var 1 */}
                    <div className="bg-slate-900/40 border border-slate-800/60 p-4 rounded-xl flex items-start gap-4">
                      <div className="w-9 h-9 shrink-0 bg-blue-500/10 flex items-center justify-center text-blue-400 rounded-lg border border-blue-500/20">
                        <Zap className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h5 className="text-xs font-bold text-slate-200">Variasi 1 (Flowing Rightward)</h5>
                          <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">Relay diaktifkan secara bergantian secara sekuensial dari kiri ke kanan dengan jeda 800ms.</p>
                        </div>
                        <button
                          id="btn-var-1"
                          onClick={handleVariation1}
                          className="bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/10 text-white font-sans text-[11px] font-semibold py-1.5 px-3.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5"
                        >
                          <Play className="w-3 h-3" />
                          <span>Jalankan Variasi 1</span>
                        </button>
                      </div>
                    </div>

                    {/* Var 2 */}
                    <div className="bg-slate-900/40 border border-slate-800/60 p-4 rounded-xl flex items-start gap-4">
                      <div className="w-9 h-9 shrink-0 bg-indigo-500/10 flex items-center justify-center text-indigo-400 rounded-lg border border-indigo-500/20">
                        <RefreshCw className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h5 className="text-xs font-bold text-slate-200">Variasi 2 (Strobe Synchronous)</h5>
                          <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">Seluruh relay dinyalakan dan dimatikan secara bersamaan dengan ketukan kilat layaknya strobo.</p>
                        </div>
                        <button
                          id="btn-var-2"
                          onClick={handleVariation2}
                          className="bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/10 text-white font-sans text-[11px] font-semibold py-1.5 px-3.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5"
                        >
                          <Play className="w-3 h-3" />
                          <span>Jalankan Variasi 2</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. CONFIGURATION FORMS TAB */}
            {activeTab === 'mqtt-config' && (
              <div className="space-y-6" id="view-config">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <Settings2 className="w-5 h-5 text-indigo-400" />
                      Konfigurasi Multi-Broker MQTT
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-sans">
                      Perbarui URL websocket dan kredensial untuk ketiga broker. Sandi tidak di-hardcode (disimpan dalam sandboxing localStorage).
                    </p>
                  </div>
                  <button
                    id="btn-reset-config"
                    onClick={handleResetAllConfigs}
                    className="border border-red-500/30 hover:border-red-500/50 bg-red-950/10 hover:bg-red-950/30 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer font-sans transition-all"
                  >
                    Reset Sandboxes
                  </button>
                </div>

                {/* Submenu for brokers selector */}
                <div className="flex border-b border-slate-800/80 gap-3 pb-px">
                  {brokers.map((broker, idx) => {
                    const isSelected = configBrokerIndex === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          playBeep(700, 0.05);
                          setConfigBrokerIndex(idx);
                        }}
                        className={`pb-3 text-xs uppercase tracking-wider font-mono font-medium transition-all border-b-[2px] cursor-pointer ${
                          isSelected 
                            ? 'text-indigo-400 border-indigo-400 font-extrabold' 
                            : 'text-slate-400 border-transparent hover:text-slate-300'
                        }`}
                      >
                        {broker.name} ({broker.isConnected ? 'CONNECTED' : 'DISCONNECTED'})
                      </button>
                    );
                  })}
                </div>

                {/* Active Broker edit Form */}
                {brokers[configBrokerIndex] && (
                  <div className="bg-[#111827]/50 border border-slate-800 px-5 py-6 rounded-2xl">
                    <form onSubmit={handleSaveConfig} className="space-y-5">
                      
                      <div className="flex items-center justify-between border-b border-slate-800/50 pb-3 mb-2">
                        <span className="text-[11px] font-mono uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-md font-bold">
                          {brokers[configBrokerIndex].type}
                        </span>
                        
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400">Status Gateway:</span>
                          <span className={`font-semibold ${brokers[configBrokerIndex].isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                            {brokers[configBrokerIndex].isConnected ? 'TERKONEKSI' : 'DISCONNECTED'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        
                        <div>
                          <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5 font-medium">WebSocket Connection URL</label>
                          <input
                            type="text"
                            value={formUrls[configBrokerIndex] || ''}
                            onChange={(e) => {
                              const update = [...formUrls];
                              update[configBrokerIndex] = e.target.value;
                              setFormUrls(update);
                            }}
                            className="w-full bg-[#1e293b]/50 border border-slate-700/80 rounded-xl py-2.5 px-4 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-sans"
                            placeholder="wss:// ISI_WEBSOCKET_URL"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5 font-medium">Port Gateway</label>
                          <input
                            type="number"
                            value={formPorts[configBrokerIndex] || ''}
                            onChange={(e) => {
                              const update = [...formPorts];
                              update[configBrokerIndex] = parseInt(e.target.value);
                              setFormPorts(update);
                            }}
                            className="w-full bg-[#1e293b]/50 border border-slate-700/80 rounded-xl py-2.5 px-4 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono"
                            placeholder="443"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5 font-medium">Username</label>
                          <input
                            type="text"
                            value={formUsernames[configBrokerIndex] || ''}
                            onChange={(e) => {
                              const update = [...formUsernames];
                              update[configBrokerIndex] = e.target.value;
                              setFormUsernames(update);
                            }}
                            className="w-full bg-[#1e293b]/50 border border-slate-700/80 rounded-xl py-2.5 px-4 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-sans"
                            placeholder="Username"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5 font-medium">Password (Sensitive)</label>
                          <input
                            type="password"
                            value={formPasswords[configBrokerIndex] || ''}
                            onChange={(e) => {
                              const update = [...formPasswords];
                              update[configBrokerIndex] = e.target.value;
                              setFormPasswords(update);
                            }}
                            className="w-full bg-[#1e293b]/50 border border-slate-700/80 rounded-xl py-2.5 px-4 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono"
                            placeholder="••••••••••••••"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5 font-medium">Client ID</label>
                          <input
                            type="text"
                            value={formClientIds[configBrokerIndex] || ''}
                            onChange={(e) => {
                              const update = [...formClientIds];
                              update[configBrokerIndex] = e.target.value;
                              setFormClientIds(update);
                            }}
                            className="w-full bg-[#1e293b]/50 border border-slate-700/80 rounded-xl py-2.5 px-4 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono"
                            required
                          />
                          <div className="mt-2.5 flex items-start gap-2 bg-[#1e293b]/20 p-2.5 rounded-lg border border-slate-800">
                            <input
                              type="checkbox"
                              id="toggle-random-clientid"
                              checked={!!formUseRandomSuffix[configBrokerIndex]}
                              onChange={(e) => {
                                const update = [...formUseRandomSuffix];
                                update[configBrokerIndex] = e.target.checked;
                                setFormUseRandomSuffix(update);
                              }}
                              className="mt-0.5 w-3.5 h-3.5 accent-indigo-500 bg-slate-900 border-slate-800 rounded cursor-pointer shrink-0"
                            />
                            <div className="text-[11px] leading-relaxed text-slate-400">
                              <label htmlFor="toggle-random-clientid" className="font-semibold text-slate-300 cursor-pointer block">
                                Gunakan Suffix Acak Unik (Sangat Direkomendasikan)
                              </label>
                              Mencantumkan 4 digit acak di belakang Client ID saat terhubung agar tidak bentrok dengan sirkuit hardware (ESP32) atau tab browser lain yang menggunakan ID yang sama.
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5 font-medium">Base Topic System</label>
                          <input
                            type="text"
                            value={formBaseTopics[configBrokerIndex] || ''}
                            onChange={(e) => {
                              const update = [...formBaseTopics];
                              update[configBrokerIndex] = e.target.value;
                              setFormBaseTopics(update);
                            }}
                            className="w-full bg-[#1e293b]/50 border border-slate-700/80 rounded-xl py-2.5 px-4 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono"
                            required
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                        
                        {/* Connection Diagnostic display */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestBrokerConnection(configBrokerIndex)}
                            disabled={testResults[brokers[configBrokerIndex].name] === 'testing'}
                            className="border border-slate-700 hover:border-slate-600 hover:bg-slate-800 px-3.5 py-2 rounded-xl text-slate-300 hover:text-white font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            {testResults[brokers[configBrokerIndex].name] === 'testing' ? (
                              <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            <span>Test Koneksi</span>
                          </button>

                          {/* Quick validation result stamp */}
                          {testResults[brokers[configBrokerIndex].name] === 'success' && (
                            <span className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                              OK
                            </span>
                          )}
                          {testResults[brokers[configBrokerIndex].name] === 'failed' && (
                            <span className="text-[11px] font-mono text-red-400 font-bold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5 shrink-0" />
                              Gagal (Timeout/Kredensial)
                            </span>
                          )}
                        </div>

                        <button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-5 rounded-xl text-xs transition-all shadow-lg hover:shadow-indigo-500/10 cursor-pointer"
                        >
                          Simpan & Aktifkan Gateway
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* 6. STORAGE TABLE: DATA SUHU */}
            {activeTab === 'data-suhu' && (
              <div className="space-y-6" id="view-suhu-logs">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-400" />
                      Riwayat Telemetri Suhu
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-sans">
                      Daftar rekaman suhu DHT yang masuk dan dikoordinasikan oleh broker MQTT aktif dalam local storage.
                    </p>
                  </div>
                  <button
                    id="btn-clear-suhu-logs"
                    onClick={handleClearSuhuLogs}
                    disabled={suhuLogs.length === 0}
                    className="bg-red-950/10 hover:bg-red-950/30 text-red-400 border border-red-900/20 hover:border-red-900/40 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Data</span>
                  </button>
                </div>

                <div className="bg-[#111827]/50 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-800 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                          <th className="py-3 px-5">Waktu Diterima</th>
                          <th className="py-3 px-5">Broker Terpilih</th>
                          <th className="py-3 px-5">Nilai Suhu</th>
                          <th className="py-3 px-5 text-right">Parameter</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium">
                        {suhuLogs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center font-mono text-slate-500">
                              Belum ada telemetri suhu yang terekam. Aktifkan simulasi atau hubungkan broker MQTT.
                            </td>
                          </tr>
                        ) : (
                          suhuLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-900/30 transition-all">
                              <td className="py-3 px-5 text-slate-300 font-mono">
                                {log.timestamp.replace('T', ' ').substring(0, 19)}
                              </td>
                              <td className="py-3 px-5">
                                <span className="text-slate-200">{log.broker}</span>
                              </td>
                              <td className="py-3 px-5 font-mono text-emerald-400 font-bold">{log.value}°C</td>
                              <td className="py-3 px-5 text-right font-mono text-slate-500">Celcius (C)</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 7. STORAGE TABLE: DATA KELEMBAPAN */}
            {activeTab === 'data-kelembapan' && (
              <div className="space-y-6" id="view-lembap-logs">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <FileText className="w-5 h-5 text-cyan-400" />
                      Riwayat Telemetri Kelembapan
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-sans">
                      Daftar rekaman kelembaban persen relative humidity yang terekam secara berkala.
                    </p>
                  </div>
                  <button
                    id="btn-clear-lembap-logs"
                    onClick={handleClearLembapLogs}
                    disabled={lembapLogs.length === 0}
                    className="bg-red-950/10 hover:bg-red-950/30 text-red-400 border border-red-900/20 hover:border-red-900/40 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Data</span>
                  </button>
                </div>

                <div className="bg-[#111827]/50 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-800 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                          <th className="py-3 px-5">Waktu Diterima</th>
                          <th className="py-3 px-5">Broker Terpilih</th>
                          <th className="py-3 px-5">Kelembapan Persen</th>
                          <th className="py-3 px-5 text-right">Parameter</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium">
                        {lembapLogs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center font-mono text-slate-500">
                              Belum ada telemetri kelembapan yang terekam.
                            </td>
                          </tr>
                        ) : (
                          lembapLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-900/30 transition-all">
                              <td className="py-3 px-5 text-slate-300 font-mono">
                                {log.timestamp.replace('T', ' ').substring(0, 19)}
                              </td>
                              <td className="py-3 px-5">
                                <span className="text-slate-200">{log.broker}</span>
                              </td>
                              <td className="py-3 px-5 font-mono text-cyan-400 font-bold">{log.value}% RH</td>
                              <td className="py-3 px-5 text-right font-mono text-slate-500">Percent (%)</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 8. STORAGE TABLE: LOG MQTT PANEL */}
            {activeTab === 'log-mqtt' && (
              <div className="space-y-6" id="view-mqtt-logs">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-400" />
                      Log Transmisi Hub MQTT
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 font-sans">
                      Konsol pesan real-time untuk log koneksi, subscribe callback, publish paket relay, dan event kegagalan dari ketiga broker.
                    </p>
                  </div>
                  <button
                    id="btn-clear-mqtt-logs"
                    onClick={handleClearMqttLogs}
                    disabled={mqttLogs.length === 0}
                    className="bg-red-950/10 hover:bg-red-950/30 text-red-400 border border-red-900/20 hover:border-red-900/40 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Logs</span>
                  </button>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden p-4 font-mono select-text">
                  <div className="max-h-[500px] overflow-y-auto space-y-2.5 text-xs pr-1 custom-scrollbar flex flex-col">
                    {mqttLogs.length === 0 ? (
                      <p className="text-center py-6 text-slate-500">
                        Belum ada aktivitas komunikasi yang dicatat di konsol log.
                      </p>
                    ) : (
                      mqttLogs.map((log) => {
                        let textClass = 'text-slate-300';
                        if (log.type === 'error') textClass = 'text-red-400 font-bold';
                        else if (log.type === 'publish') textClass = 'text-blue-400';
                        else if (log.type === 'subscribe') textClass = 'text-cyan-400';
                        else if (log.type === 'command') textClass = 'text-violet-400';

                        return (
                          <div key={log.id} className="pb-2 border-b border-slate-900 hover:bg-slate-900/20 transition-all flex items-start gap-3">
                            <span className="text-slate-500 shrink-0 select-none">
                              [{log.timestamp.substring(11, 19)}]
                            </span>
                            <span className="bg-slate-900 border border-slate-800/80 px-2 py-0.5 rounded text-[10px] text-indigo-400 shrink-0 font-bold uppercase select-none">
                              {log.broker.replace(' (Simulasi)', '')}
                            </span>
                            <p className={`leading-relaxed break-all ${textClass}`}>
                              {log.message}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}
