import s from './Eyebrow.module.css';

export default function Eyebrow({ children }) {
  return <p className={s.eyebrow}>{children}</p>;
}
