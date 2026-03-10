import { useEffect, useState } from "react";
import { defaultPath } from "../config/pageCatalog";

function getPathFromHash() {
  const raw = window.location.hash.replace(/^#/, "");

  if (!raw || raw === "/") {
    return defaultPath;
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function useHashLocation() {
  const [pathname, setPathname] = useState<string>(getPathFromHash());

  useEffect(() => {
    const handleChange = () => {
      setPathname(getPathFromHash());
    };

    window.addEventListener("hashchange", handleChange);
    return () => window.removeEventListener("hashchange", handleChange);
  }, []);

  const navigate = (nextPath: string) => {
    const normalized = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
    window.location.hash = normalized;
  };

  return { pathname, navigate };
}
