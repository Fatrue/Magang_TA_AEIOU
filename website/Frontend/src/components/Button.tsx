import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({ children, className = "", type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return <button type={type} className={className} {...rest}>{children}</button>;
}