import { useEffect, useId, useRef, useState } from "react";
import { LogOut, Settings, UserRound } from "lucide-react";

export default function AccountMenu({
  email,
  onAccount,
  onSettings,
  onSignOut,
}: {
  email: string;
  onAccount: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const initialItem = useRef(0);
  const id = useId();
  const initial = email.trim().charAt(0).toUpperCase() || "P";

  useEffect(() => {
    if (!open) return;
    const items =
      menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    items?.[initialItem.current]?.focus();
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function select(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div
      className="account-menu"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className="account-trigger"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          initialItem.current = 0;
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            initialItem.current = event.key === "ArrowUp" ? 2 : 0;
            setOpen(true);
          }
        }}
      >
        <span className="avatar small" aria-hidden="true">
          {initial}
        </span>
      </button>
      {open && (
        <div className="account-dropdown">
          <div className="account-menu-identity">
            <span className="avatar" aria-hidden="true">
              {initial}
            </span>
            <div className="min-w-0">
              <strong title={email}>{email}</strong>
              <small>Signed in</small>
            </div>
          </div>
          <div
            id={id}
            ref={menu}
            role="menu"
            aria-label="Account"
            onKeyDown={(event) => {
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  '[role="menuitem"]',
                ),
              );
              const current = items.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              let next: number;
              if (event.key === "ArrowDown")
                next = (current + 1) % items.length;
              else if (event.key === "ArrowUp")
                next = (current - 1 + items.length) % items.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = items.length - 1;
              else if (
                event.key.length === 1 &&
                !event.ctrlKey &&
                !event.metaKey &&
                event.key !== " "
              ) {
                next = items.findIndex(
                  (item, index) =>
                    index > current &&
                    item.textContent
                      ?.trim()
                      .toLowerCase()
                      .startsWith(event.key.toLowerCase()),
                );
                if (next === -1)
                  next = items.findIndex((item) =>
                    item.textContent
                      ?.trim()
                      .toLowerCase()
                      .startsWith(event.key.toLowerCase()),
                  );
                if (next === -1) return;
              } else return;
              event.preventDefault();
              items[next]?.focus();
            }}
          >
            <button
              role="menuitem"
              tabIndex={-1}
              onClick={() => select(onAccount)}
            >
              <UserRound size={18} aria-hidden="true" />
              Profile / Account
            </button>
            <button
              role="menuitem"
              tabIndex={-1}
              onClick={() => select(onSettings)}
            >
              <Settings size={18} aria-hidden="true" />
              Settings
            </button>
            <div className="account-menu-divider" role="separator" />
            <button
              role="menuitem"
              tabIndex={-1}
              onClick={() => select(onSignOut)}
            >
              <LogOut size={18} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
