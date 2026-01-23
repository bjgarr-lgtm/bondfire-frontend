import React from 'react';
import { Outlet, useParams } from 'react-router-dom';  // ✅ make sure useParams is imported
import { useOrg } from '../context/OrgContext';
import { getState } from '../utils_store';

export default function InnerSanctum() {
  const { orgId } = useParams();
  const ctx = (typeof useOrg === 'function' ? useOrg() : {}) || {};
  const orgNameFromCtx = ctx.orgName || null;
  const s = getState();

  return (
    <div style={{ padding: 0 }}>
      {/* orgNameFromCtx or s.currentOrgId could be used in breadcrumbs if needed */}
      <Outlet />
    </div>
  );
}
