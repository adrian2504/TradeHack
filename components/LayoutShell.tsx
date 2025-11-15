import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function LayoutShell({ children }: Props) {
  return (
    <div className="space-y-4">
      {children}
    </div>
  );
}
