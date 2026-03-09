let activeIncidents = {};

export function processMotionEvent(event, escalateCallback) {

  const id = event.user_id;

  if (!event.impact_flag) {
    return { status: "no impact detected" };
  }

  const incidentId = Date.now();

  activeIncidents[incidentId] = {
    id: incidentId,
    user_id: event.user_id,
    gps: event.gps,
    acceleration: event.acceleration,
    created: Date.now()
  };

  // simulate escalation delay
  setTimeout(() => {

    if (activeIncidents[incidentId]) {
      escalateCallback(activeIncidents[incidentId]);
    }

  }, 10000);

  return {
    status: "incident created",
    incidentId
  };
}

export function cancelIncident(id) {

  if (activeIncidents[id]) {
    delete activeIncidents[id];
    return true;
  }

  return false;
}
