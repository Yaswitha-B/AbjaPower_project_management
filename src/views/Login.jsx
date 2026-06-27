import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkPassword } from '../api/client.js';
import { AUTH_KEY } from '../lib/constants.js';
import s from './Login.module.css';

export default function Login({ onSuccess }) {
  const [pw, setPw]       = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);
  const navigate          = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!pw.trim()) return;
    setBusy(true); setError('');
    try {
      await checkPassword(pw.trim());
      localStorage.setItem(AUTH_KEY, '1');
      if (onSuccess) onSuccess();
      navigate('/');
    } catch {
      setError('Wrong password. Try again.');
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
        <form onSubmit={submit}>
          <input
            id="gpwd"
            className={s.gpwd}
            type="password"
            placeholder="Enter password"
            autoComplete="off"
            autoFocus
            value={pw}
            onChange={e => setPw(e.target.value)}
          />
          <button className={s.gbtn} type="submit" disabled={busy || !pw.trim()}>
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </form>
        <div className={s.gerr} role="alert">{error}</div>
        <div className={s.gnote}>
          Authorised access only. Contact your project lead for the password.
        </div>
      </div>
    </div>
  );
}
