import { Suspense } from "react";
import { StudioProvider } from "@/components/studio/studio-context";
import { OutboxSync } from "@/components/studio/outbox-sync";

// Host app: the installed PWA. The proxy redirects
// signed-out users to "/" before this renders. Each screen sets its own
// theme (paper for setup, ink for on-camera) and includes <StudioNav /> only
// on the four tab screens.
export default function StudioLayout({ children }: LayoutProps<"/studio">) {
  return (
    <Suspense>
      <StudioProvider>
        <OutboxSync />
        <div className="flex flex-1 flex-col">{children}</div>
      </StudioProvider>
    </Suspense>
  );
}
