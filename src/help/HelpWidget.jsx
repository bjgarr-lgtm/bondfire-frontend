// src/help/HelpWidget.jsx
import React from "react";
import { useLocation } from "react-router-dom";
import HelpPanel from "./HelpPanel.jsx";
import { guessTopicIdFromPath } from "./helpContent.js";
import "./help.css";

export default function HelpWidget() {
  const loc = useLocation();
  const [open, setOpen] = React.useState(false);
  const [activeId, setActiveId] = React.useState(() => guessTopicIdFromPath(loc?.pathname));

  const [pulse, setPulse] = React.useState(() => {
    try {
      return localStorage.getItem("bf_help_seen") ? false : true;
    } catch {
      return true;
    }
  });

  React.useEffect(() => {
    // If panel isn't open, keep the active topic aligned to where the user is.
    if (open) return;
    setActiveId(guessTopicIdFromPath(loc?.pathname));
  }, [loc?.pathname, open]);

  function onOpen() {
    setOpen(true);
    if (pulse) {
      setPulse(false);
      try { localStorage.setItem("bf_help_seen", "1"); } catch {}
    }
  }

  return (
    <>
      <button
        type="button"
        className="bf-help-fab"
        onClick={onOpen}
        aria-label="Need help"
        title="Need help?"
      >
        {pulse ? <span className="bf-help-pulse" /> : null}
        <span style={{ fontSize: 20, fontWeight: 900 }}>?</span>
      </button>

      <HelpPanel
        open={open}
        activeId={activeId}
        setActiveId={setActiveId}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
