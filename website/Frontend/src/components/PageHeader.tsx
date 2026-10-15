import { Link } from "react-router-dom";
import { Icon } from "./Icon";

export function PageHeader({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  return (
    <div>
      <Link to="/lainnya" className="back-link"><Icon name="back" size={18} /> Lainnya</Link>
      <div className="page-title"><span className="section-kicker">{kicker}</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
    </div>
  );
}