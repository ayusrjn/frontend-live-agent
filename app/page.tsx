'use client';

import { useEffect, useState, useRef } from 'react';

const API_BASE_URL = '/api';

export default function Home() {
  const [currentUserId, setCurrentUserId] = useState<number>(1);
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState('');
  const [toastError, setToastError] = useState(false);
  
  const [isCalling, setIsCalling] = useState(false);
  const [callStatus, setCallStatus] = useState('Connecting...');
  const [callStatusError, setCallStatusError] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);

  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef(0);
  const lastServerErrorRef = useRef<string | null>(null);

  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    async function initDb() {
      try {
        await fetch(`${API_BASE_URL}/seed`, { method: 'POST' }).catch(() => console.log('Seed failed'));
        setDbReady(true);
      } catch (err) {
        showToast('Error setting up DB', true);
        setDbReady(true);
      }
    }
    initDb();
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    async function fetchData() {
      try {
        await fetchUserProfile();
        await fetchOrders();
      } catch (err) {
        showToast('Error fetching user data', true);
      }
    }
    fetchData();
  }, [currentUserId, dbReady]);

  const fetchUserProfile = async () => {
    const res = await fetch(`${API_BASE_URL}/users/${currentUserId}`);
    if (res.ok) {
      setUser(await res.json());
    }
  };

  const fetchOrders = async () => {
    const res = await fetch(`${API_BASE_URL}/orders/${currentUserId}`);
    if (res.ok) {
      setOrders(await res.json());
    }
  };

  const changeUserRandomly = () => {
    let nextUser = currentUserId;
    while (nextUser === currentUserId) {
      nextUser = Math.floor(Math.random() * 5) + 1;
    }
    setCurrentUserId(nextUser);
  };

  const showToast = (msg: string, isError = false) => {
    setToastMsg(msg);
    setToastError(isError);
    setTimeout(() => {
      setToastMsg('');
    }, 3000);
  };

  const requestRefund = async (orderId: number) => {
    const res = await fetch(`${API_BASE_URL}/support/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUserId, order_id: orderId, reason: "Automated test refund request" })
    });
    if (res.ok) {
      showToast('Refund initiated!');
      await fetchOrders();
      await fetchUserProfile();
    } else {
      showToast('Failed to request refund.', true);
    }
  };

  const endCall = () => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.close();
    }
    if (scriptNodeRef.current) {
      try { scriptNodeRef.current.disconnect(); } catch (e) {}
      scriptNodeRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsCalling(false);
    setTranscript([]);
    setCallStatus('Connecting...');
    setCallStatusError(false);
  };

  const startVoiceAgent = async () => {
    if (isCalling) {
      endCall();
      showToast('Call ended.');
      return;
    }

    setIsCalling(true);
    lastServerErrorRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextCtor({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      
      nextPlayTimeRef.current = audioCtx.currentTime;
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptNodeRef.current = processor;

      setCallStatus('Dialing voice agent...');
      
      // Needs to point to the standalone voice_agent_server still running on 8080!
      // However, we are connecting to cloud run eventually, so standard is to use environment variable
      const defaultWsUrl = typeof window !== 'undefined' ? `ws://${window.location.hostname}:8080/ws/voice` : 'ws://localhost:8080/ws/voice';
      const wsUrl = process.env.NEXT_PUBLIC_VOICE_AGENT_URL || defaultWsUrl;
      const ws = new WebSocket(`${wsUrl}?user_id=${currentUserId}`);
      websocketRef.current = ws;

      ws.onopen = () => {
        setCallStatus('Connected — speak now');
        setCallStatusError(false);
        source.connect(processor);
        processor.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            let s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(pcm16.buffer);
          }
        };
      };

      ws.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          const arrayBuffer = await event.data.arrayBuffer();
          const view = new Int16Array(arrayBuffer);
          const float32 = new Float32Array(view.length);
          for (let i = 0; i < view.length; i++) {
            float32[i] = view[i] / 32768.0;
          }
          const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
          audioBuffer.getChannelData(0).set(float32);
          const playSource = audioCtx.createBufferSource();
          playSource.buffer = audioBuffer;
          playSource.connect(audioCtx.destination);

          const currentTime = audioCtx.currentTime;
          if (nextPlayTimeRef.current < currentTime) {
            nextPlayTimeRef.current = currentTime;
          }
          playSource.start(nextPlayTimeRef.current);
          nextPlayTimeRef.current += audioBuffer.duration;
        } else {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'error') {
              lastServerErrorRef.current = msg.message;
              setCallStatus(msg.message);
              setCallStatusError(true);
              setTranscript(prev => [...prev, '⚠ ' + msg.message]);
            } else if (msg.type === 'text') {
              setTranscript(prev => [...prev, '🤖 ' + msg.text]);
            }
          } catch (e) {}
        }
      };

      ws.onclose = () => {
        if (scriptNodeRef.current) { try { scriptNodeRef.current.disconnect(); } catch (e) {} }
        if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
        
        if (lastServerErrorRef.current) {
          setTimeout(() => {
            setIsCalling(false);
            showToast(lastServerErrorRef.current!, true);
          }, 3000);
        } else {
          setIsCalling(false);
          showToast('Call ended.');
        }
      };

      ws.onerror = () => {
        setCallStatus('Connection failed — is the voice server running?');
        setCallStatusError(true);
        setTimeout(() => {
          endCall();
          showToast('Could not connect to voice agent server.', true);
        }, 2500);
      };

    } catch (err) {
      setIsCalling(false);
      showToast('Microphone access denied or error.', true);
    }
  };

  const activeOrder = orders.find(o => o.status !== 'Delivered' && o.status !== 'Cancelled');
  const pastOrders = orders.filter(o => o.status === 'Delivered' || o.status === 'Cancelled' || o._id !== (activeOrder ? activeOrder._id : -1));

  return (
    <>
      <div className="app-container glass-panel">
        <header className="app-header">
          <div className="logo-container">
            <div className={`circle ${isCalling && !callStatusError ? 'pulse' : ''}`} style={isCalling && !callStatusError ? {backgroundColor: '#28a745'} : {}}></div>
            <h1>Zomato Live Support</h1>
          </div>
          <div className="user-profile">
            <span className="user-greeting">{user ? `Hi, ${user.name.split(' ')[0]}` : 'Loading...'}</span>
          </div>
        </header>

        <main className="content-area">
          <section className="account-section" style={{ marginBottom: '20px' }}>
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                  <h2>Account Summary</h2>
                  <p style={{ marginTop: '5px', fontSize: '1.2rem'}}>Wallet Balance: <strong>₹{user?.wallet_balance ? user.wallet_balance.toFixed(2) : '0.00'}</strong></p>
               </div>
               <button onClick={changeUserRandomly} className="btn secondary-btn">
                 Random User Change
               </button>
            </div>
          </section>

          <section className="active-order-section">
            <h2>Active Order</h2>
            {!orders.length ? (
              <div className="card order-card shimmer">
                <div style={{ height: '20px', width: '60%', background: '#333', marginBottom: '10px', borderRadius: '4px' }}></div>
                <div style={{ height: '15px', width: '40%', background: '#333', borderRadius: '4px' }}></div>
              </div>
            ) : activeOrder ? (
              <div className="card order-card">
                <div className="order-header">
                  <span className="restaurant-name">{activeOrder.restaurant_name}</span>
                  <span className={`order-status status-${activeOrder.status.toLowerCase().replace(' ', '-')}`}>{activeOrder.status}</span>
                </div>
                <div className="order-amount">Total: ₹{activeOrder.total_amount.toFixed(2)}</div>
              </div>
            ) : (
              <div className="card order-card"><p>No active orders right now.</p></div>
            )}
          </section>

          <section className="support-actions">
            <h2>Support Actions</h2>
            <div className="action-buttons">
              <button onClick={startVoiceAgent} className="btn primary-btn pulse-glow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                Call Voice Agent
              </button>
              <button onClick={() => activeOrder ? requestRefund(activeOrder._id || activeOrder.id) : showToast('No active order to refund.', true)} className="btn secondary-btn">
                Force Request Refund
              </button>
            </div>
          </section>

          <section className="order-history-section">
            <h2>Past Orders</h2>
            <div className="order-list">
              {pastOrders.map(order => (
                <div key={order._id || order.id} className="card order-card">
                  <div className="order-header">
                    <span className="restaurant-name">{order.restaurant_name}</span>
                    <span className={`order-status status-${order.status.toLowerCase().replace(' ', '-')}`}>{order.status}</span>
                  </div>
                  <div className="order-amount">Total: ₹{order.total_amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <div className={`toast ${toastMsg ? '' : 'hidden'}`} style={{ backgroundColor: toastError ? 'var(--primary-color)' : 'var(--success-color)' }}>
          <span>{toastMsg}</span>
        </div>
      </div>

      {isCalling && (
        <div id="callOverlay" className="active">
          <div className="call-screen">
            <div className={`call-status ${callStatusError ? 'error' : ''}`} style={{ color: callStatusError ? 'var(--primary-color)' : 'var(--success-color)' }}>
              {callStatus}
            </div>
            <div className="call-visualizer">
              <div className="viz-ring ring-1"></div>
              <div className="viz-ring ring-2"></div>
              <div className="viz-ring ring-3"></div>
              <div className="viz-mic-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              </div>
            </div>
            <div className="call-transcript">
              {transcript.map((line, i) => <div key={i} className="transcript-line">{line}</div>)}
            </div>
            <button className="btn-end-call" onClick={endCall}>
              End Call
            </button>
          </div>
        </div>
      )}
    </>
  );
}
