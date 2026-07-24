'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '../../src/lib/supabase/client';
import { computeSlaDeadline, type JobPriority, type ServiceCategory, type VehicleType } from '../../src/lib/supabase/types';
import { Button, Card, Badge } from '../../src/components/primitives';

type LocationState =
  | { status: 'requesting' }
  | { status: 'auto'; lat: number; lng: number }
  | { status: 'manual'; lat: string; lng: string }
  | { status: 'denied' };

const SERVICE_OPTIONS: { value: ServiceCategory; label: string }[] = [
  { value: 'accident_emergency', label: 'Accident / Emergency' },
  { value: 'towing', label: 'Towing' },
  { value: 'jumpstart', label: 'Jumpstart (dead battery)' },
  { value: 'puncture', label: 'Puncture / Flat tyre' },
  { value: 'fuel_delivery', label: 'Fuel delivery' },
  { value: 'lockout', label: 'Lockout' },
  { value: 'minor_repair', label: 'Minor repair' },
];

/**
 * This is the real, load-bearing "help me now" flow from 01-ARCHITECTURE.md
 * section 2.1 — it writes an actual row to Supabase, which the /dispatch
 * page picks up over Realtime within roughly a second. No mock data here.
 *
 * Location: tries the browser's GPS first; if permission is denied or the
 * browser has no geolocation support, falls back to manual lat/lng entry
 * rather than blocking submission — matching the "auto-capture with manual
 * pin-drop fallback" requirement.
 */
export default function RequestHelpPage() {
  const [step, setStep] = useState<'vehicle' | 'service' | 'details'>('vehicle');
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory | null>(null);
  const [location, setLocation] = useState<LocationState>({ status: 'requesting' });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);

  function requestLocation() {
    setLocation({ status: 'requesting' });
    if (!('geolocation' in navigator)) {
      setLocation({ status: 'denied' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ status: 'auto', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocation({ status: 'denied' }),
      { timeout: 8000 }
    );
  }

  function chooseVehicle(v: VehicleType) {
    setVehicleType(v);
    setStep('service');
    requestLocation();
  }

  function chooseService(s: ServiceCategory) {
    setServiceCategory(s);
    setStep('details');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!vehicleType || !serviceCategory) return;

    let lat: number, lng: number;
    if (location.status === 'auto') {
      lat = location.lat;
      lng = location.lng;
    } else if (location.status === 'manual') {
      lat = parseFloat(location.lat);
      lng = parseFloat(location.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        setError('Please enter valid latitude/longitude numbers.');
        return;
      }
    } else {
      setError('We still need a location — enter it manually below.');
      setLocation({ status: 'manual', lat: '', lng: '' });
      return;
    }

    if (!name.trim() || !phone.trim()) {
      setError('Name and phone number are required so a technician can reach you.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const priority: JobPriority = serviceCategory === 'accident_emergency' ? 'emergency' : 'standard';

    const { data, error: insertError } = await supabase
      .from('jobs')
      .insert({
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        vehicle_type: vehicleType,
        service_category: serviceCategory,
        priority,
        status: 'requested',
        lat,
        lng,
        notes: notes.trim() || null,
        sla_deadline: computeSlaDeadline(priority),
      })
      .select('id')
      .single();

    setSubmitting(false);

    if (insertError) {
      setError(
        'Could not submit your request — please check your connection and try again. ' +
          '(If this keeps happening, call the emergency helpline directly.)'
      );
      return;
    }

    setSubmittedJobId(data.id);
  }

  if (submittedJobId) {
    return (
      <main className="byk-request-page">
        <Card className="byk-request-success">
          <h1 className="byk-request-success__title">Help is on the way</h1>
          <p>Your request has been sent to our dispatch team.</p>
          <p className="byk-request-success__id">
            Request ID: <code>{submittedJobId.slice(0, 8)}</code>
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--type-body-sm-size)' }}>
            A technician will call {phone} shortly. Keep your phone nearby.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="byk-request-page">
      <div className="byk-request-header">
        <span className="byk-topbar__brand-mark" aria-hidden="true" />
        <h1>Get help now</h1>
      </div>

      {step === 'vehicle' && (
        <div className="byk-request-grid">
          {(['car', 'bike', 'ev', 'commercial'] as VehicleType[]).map((v) => (
            <button key={v} className="byk-request-tile" onClick={() => chooseVehicle(v)}>
              {v.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {step === 'service' && (
        <div className="byk-request-grid">
          {SERVICE_OPTIONS.map((opt) => (
            <button key={opt.value} className="byk-request-tile" onClick={() => chooseService(opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {step === 'details' && (
        <form onSubmit={handleSubmit} className="byk-request-form">
          {serviceCategory === 'accident_emergency' && (
            <Badge tone="danger">Emergency — this jumps the queue</Badge>
          )}

          <div className="byk-form-field">
            <label className="byk-label" htmlFor="req-location">Location</label>
            {location.status === 'requesting' && <p id="req-location">Getting your location…</p>}
            {location.status === 'auto' && (
              <p id="req-location">
                📍 Using your current location ({location.lat.toFixed(4)}, {location.lng.toFixed(4)}){' '}
                <button type="button" className="byk-link-btn" onClick={() => setLocation({ status: 'manual', lat: '', lng: '' })}>
                  enter manually instead
                </button>
              </p>
            )}
            {location.status === 'denied' && (
              <p id="req-location">
                We couldn't get your location automatically.{' '}
                <button type="button" className="byk-link-btn" onClick={() => setLocation({ status: 'manual', lat: '', lng: '' })}>
                  Enter it manually
                </button>{' '}or <button type="button" className="byk-link-btn" onClick={requestLocation}>try GPS again</button>.
              </p>
            )}
            {location.status === 'manual' && (
              <div className="byk-demo-row">
                <input
                  className="byk-input"
                  placeholder="Latitude (e.g. 20.71)"
                  value={location.lat}
                  onChange={(e) => setLocation({ status: 'manual', lat: e.target.value, lng: location.lng })}
                />
                <input
                  className="byk-input"
                  placeholder="Longitude (e.g. 83.49)"
                  value={location.lng}
                  onChange={(e) => setLocation({ status: 'manual', lat: location.lat, lng: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="byk-form-field">
            <label className="byk-label" htmlFor="req-name">Your name</label>
            <input id="req-name" className="byk-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="byk-form-field">
            <label className="byk-label" htmlFor="req-phone">Phone number</label>
            <input id="req-phone" type="tel" className="byk-input" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>

          <div className="byk-form-field">
            <label className="byk-label" htmlFor="req-notes">Anything else? (optional)</label>
            <textarea id="req-notes" className="byk-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          {error && <p className="byk-form-error" role="alert">{error}</p>}

          <Button type="submit" size="lg" loading={submitting} variant={serviceCategory === 'accident_emergency' ? 'danger' : 'primary'}>
            {submitting ? 'Sending…' : 'Request Rescue'}
          </Button>
        </form>
      )}
    </main>
  );
}
