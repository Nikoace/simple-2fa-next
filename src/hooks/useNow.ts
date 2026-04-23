import { useEffect, useState } from "react";

export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 250);
    return () => clearInterval(id);
  }, []);

  return now;
}
