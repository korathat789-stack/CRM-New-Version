import { type HTMLAttributes } from "react";

// Card primitive: rounded (0.65rem), soft shadow, NO border. Use everywhere a
// surface is needed instead of ad-hoc borders.
export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...props} />;
}

export function CardHeader({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 border-b border-[var(--color-line)] ${className}`}
      {...props}
    />
  );
}

export function CardBody({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 ${className}`} {...props} />;
}
