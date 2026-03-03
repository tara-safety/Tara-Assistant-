let activeIncidents = {};

const IMPACT_THRESHOLD = 6.5; // adjust later

export function processMotionEvent(data, escalateCallback) {
  const { user_id, acceleration, impact_flag, gps } = data;

  if (!impact_flag || acceleration < IMPACT_THRESHOLD) {
    return { triggered: false };
  }

  const incidentId = Date.now().toString();

  activeIncidents[incidentId] = {
    user_id,
    gps,
    status: "pending"
  };

  // 10 second countdown
  setTimeout(() => {
    if (activeIncidents[incidentId]?.status === "pending") {
      activeIncidents[incidentId].status = "escalated";
      escalateCallback(activeIncidents[incidentId]);
    }
  }, 10000);

  return {
    triggered: true,
    incidentId
  };
}

export function cancelIncident(incidentId) {
  if (activeIncidents[incidentId]) {
    activeIncidents[incidentId].status = "cancelled";
    return true;
  }
  return false;
}
