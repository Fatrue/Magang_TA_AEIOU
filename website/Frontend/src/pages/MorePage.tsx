import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Icon, type IconName } from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { useIrrigation } from "../context/IrrigationContext";

const menuItems: { to: string; title: string; detail: string; icon: IconName; tone: string }[] = [
  { to: "/lainnya/sensor", title: "Sensor", detail: "Data sensor dan grafik 24 jam", icon: "sensor", tone: "green" },
  { to: "/lainnya/jadwal", title: "Jadwal", detail: "Atur jam evaluasi penyiraman", icon: "calendar", tone: "blue" },
  { to: "/lainnya/riwayat", title: "Riwayat", detail: "Riwayat penyiraman per zona", icon: "history", tone: "purple" },
  { to: "/lainnya/sistem", title: "Sistem & Error", detail: "Status perangkat dan log gangguan", icon: "alert", tone: "orange" },
  { to: "/lainnya/pengaturan", title: "Pengaturan", detail: "Kalibrasi sensor dan parameter", icon: "settings", tone: "gray" },
];

export function MorePage() {
  const { user, logout } = useAuth();
  const { status } = useIrrigation();
  const healthy = status.online && !status.lastError;

  return (
    <main className="page more-page">
      <div className="page-title"><span className="section-kicker">Informasi & pengaturan</span><h2>Lainnya</h2><p>Kelola detail sistem irigasi Anda.</p></div>
      <div className="system-summary"><div><span className="system-logo"><Icon name="leaf" /></span><div><strong>Kebun BRMP Jakarta</strong><p>{healthy ? "Semua sistem bekerja normal" : "Ada hal yang perlu dicek"}</p></div></div><span className={`healthy ${healthy ? "" : "is-down"}`}><i /> {healthy ? "Sehat" : "Perlu dicek"}</span></div>
      <div className="menu-list">
        {menuItems.map((item) => (
          <div key={item.to} className="menu-wrap">
            <Link className="menu-card" to={item.to}>
              <span className={`menu-icon ${item.tone}`}><Icon name={item.icon} /></span><span><strong>{item.title}</strong><small>{item.detail}</small></span><Icon name="chevron" />
            </Link>
          </div>
        ))}
      </div>
      <div className="card account-card">
        <div><strong>{user?.name}</strong><small>{user?.role === "admin" ? "Admin" : "Hanya lihat"}</small></div>
        <Button className="secondary-button" onClick={logout}><Icon name="logout" size={18} /> Keluar</Button>
      </div>
      <p className="version">Irigasi BRMP · Versi 1.0</p>
    </main>
  );
}