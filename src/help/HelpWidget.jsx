
import React, { useEffect, useState } from "react";

export default function HelpWidget() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const hide = () => setHidden(true);
    const show = () => setHidden(false);

    window.addEventListener("bf-tour-start", hide);
    window.addEventListener("bf-tour-end", show);

    return () => {
      window.removeEventListener("bf-tour-start", hide);
      window.removeEventListener("bf-tour-end", show);
    };
  }, []);

  if (hidden) return null;

  return (
    <div className="help-widget">
      <button className="help-button">?</button>
    </div>
  );
}
