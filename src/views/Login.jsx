import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authClient } from '../auth.js';
import { checkSession, saveRecord } from '../api/client.js';
import s from './Login.module.css';

export default function Login({ onSuccess }) {
  const [step, setStep]   = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode]   = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);
  const navigate          = useNavigate();

  const sendCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setError('');
    try {
      const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: 'sign-in' });
      if (err) throw err;
      setStep('code');
    } catch {
      setError('Could not send code. Check the email and try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true); setError('');
    try {
      const { error: err } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code.trim() });
      if (err) throw err;

      // The code was correct — a failure past this point means the email
      // isn't on the allowlist, not that the code was wrong. Worth telling
      // people the real reason instead of "wrong code," which sends them
      // looking for a typo that isn't there.
      let user;
      try {
        ({ user } = await checkSession());
      } catch {
        setError("This email isn't authorized. Contact your admin for access.");
        return;
      }

      await saveRecord({ type: 'login' });
      onSuccess(user);
      // Reporters have exactly one page — land them there directly instead
      // of bouncing off "/" first.
      navigate(user.role === 'reporter' ? '/entry' : '/');
    } catch {
      setError('Wrong or expired code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.gate}>
      <div className={s.gbox}>
        <div className={s.glock} aria-hidden="true" />
        <div className={s.gbrand}>ABJA <b>POWER</b></div>
        <div className={s.gsub}>Project Review Board · Confidential</div>

        {step === 'email' ? (
          <form onSubmit={sendCode}>
            <input
              className={s.ginput}
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <button className={s.gbtn} type="submit" disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <div className={s.gnote} style={{ marginTop: 22 }}>Code sent to {email}</div>
            <input
              className={s.ginput}
              type="text"
              inputMode="numeric"
              placeholder="Enter code"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={e => setCode(e.target.value)}
            />
            <button className={s.gbtn} type="submit" disabled={busy || !code.trim()}>
              {busy ? 'Verifying…' : 'Verify & sign in'}
            </button>
            <button
              type="button"
              className={s.gbtn}
              style={{ background: 'transparent', color: 'var(--steel)', marginTop: 6 }}
              onClick={() => { setStep('email'); setCode(''); setError(''); }}
            >
              Use a different email
            </button>
          </form>
        )}

        <div className={s.gerr} role="alert">{error}</div>
        <div className={s.gnote}>
          Authorised access only. Contact your project lead if you don't have access.
        </div>
      </div>
    </div>
  );
}
