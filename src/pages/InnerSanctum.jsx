// InnerSanctum.jsx
import React from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useOrg } from "../context/OrgContext";
import { getState } from "../utils_store";

export default function InnerSanctum() {
  const nav = useNavigate();
  const { orgId } = useParams();
  const ctx = (typeof useOrg === "function" ? useOrg() : {}) || {};
  const s = getState();

  const orgName = ctx.orgName || ctx.org?.name || s?.currentOrgName || orgId;

  return (
    <div style={{ padding: 0 }}>
      <div
        className="card"
        style={{
          margin: 16,
          padding: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button className="btn" onClick={() => nav("/orgs")}>
          All Orgs
        </button>

        <div className="helper" style={{ minWidth: 0 }}>
          <strong>Org:</strong>{" "}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {orgName}
          </span>
        </div>
      </div>

      <Outlet />
    </div>
  );
}
