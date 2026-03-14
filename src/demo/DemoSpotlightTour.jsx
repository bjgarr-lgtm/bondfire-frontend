
import React, { useEffect } from "react";

export default function DemoSpotlightTour({ running, onEnd }) {

  useEffect(() => {
    if (running) {
      window.dispatchEvent(new Event("bf-tour-start"));
    }
  }, [running]);

  const finishTour = () => {
    window.dispatchEvent(new Event("bf-tour-end"));
    if (onEnd) onEnd();
  };

  return (
    <div className="demo-tour-overlay">
      {/* your existing tour UI */}
      <button onClick={finishTour}>Finish Tour</button>
    </div>
  );
}
