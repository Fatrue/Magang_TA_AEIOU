import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "./Icon";

const items: { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: "/", label: "Beranda", icon: "home", end: true },
  { to: "/kontrol", label: "Kontrol", icon: "control", end: false },
  { to: "/lainnya", label: "Lainnya", icon: "more", end: false },
];

export function Navigation({ online }: { online: boolean }) {
  return (
    <nav className="navigation">
      <div className="desktop-nav-brand"><span><Icon name="leaf" /></span><div><strong>Irigasi</strong><small>BRMP Jakarta</small></div></div>
      <div className="nav-items">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            <Icon name={item.icon} /><span>{item.label}</span>
          </NavLink>
        ))}
      </div>
      <div className={`desktop-system ${online ? "" : "is-down"}`}><i /> {online ? "Sistem Online" : "Sistem Offline"}</div>
    </nav>
  );
}