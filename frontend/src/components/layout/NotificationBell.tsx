import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import {
  dismissAllNotifications,
  dismissNotifications,
  listNotifications,
  type NotificationItem,
} from "../../services/api";

function renderNotificationGlyph(type: NotificationItem["type"]) {
  if (type === "critical") {
    return "!";
  }

  if (type === "warning") {
    return "!";
  }

  return "i";
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useEffectEvent(async () => {
    try {
      const response = await listNotifications();
      startTransition(() => {
        setNotifications(response);
      });
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    }
  });

  useEffect(() => {
    const pollNotifications = () => {
      void fetchNotifications();
    };

    const initialTimeout = window.setTimeout(pollNotifications, 0);
    const interval = window.setInterval(pollNotifications, 60_000);

    return () => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const dismissNotification = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await dismissNotifications([id]);
      setNotifications((current) => current.filter((notification) => notification.id !== id));
    } catch (error) {
      console.error("Failed to dismiss notification", error);
    }
  };

  const dismissAll = async () => {
    try {
      await dismissAllNotifications();
      setNotifications([]);
    } catch (error) {
      console.error("Failed to dismiss notifications", error);
    }
  };

  const unreadCount = notifications.length;

  return (
    <div className="notification-wrapper" ref={dropdownRef}>
      <button
        aria-label="View notifications"
        className="notification-bell"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 ? (
          <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 ? (
              <button className="button-text" onClick={dismissAll} type="button">
                Mark all as read
              </button>
            ) : null}
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">You&apos;re all caught up!</div>
            ) : (
              notifications.map((notification) => (
                <div className={`notification-item ${notification.type}`} key={notification.id}>
                  <div className="notification-icon">
                    {renderNotificationGlyph(notification.type)}
                  </div>
                  <div className="notification-content">
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <span className="timestamp">
                      {new Date(notification.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <button
                    aria-label="Dismiss notification"
                    className="notification-close"
                    onClick={(event) => void dismissNotification(notification.id, event)}
                    type="button"
                  >
                    <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path
                        d="M6 18L18 6M6 6l12 12"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
