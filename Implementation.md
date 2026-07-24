# Philippine Address Dropdown in React (Region → Province → City/Municipality → Barangay)

A guide to building a cascading address selector backed by live, free, official Philippine Standard Geographic Code (PSGC) data — no hardcoded arrays, no API key, no cost.

---

## 1. Why an API instead of hardcoded data

Hardcoding regions/provinces/cities/barangays as static arrays has three problems:

- **Size** — the full PSGC dataset is ~42,000 barangays. Shipping that in your JS bundle bloats load time.
- **Drift** — PSA updates the PSGC quarterly (renamed municipalities, merged barangays, new cityhood). A hardcoded list goes stale.
- **Maintenance** — you'd own the job of tracking PSA releases and patching your data file forever.

Fetching from a live API keeps the data current and out of your bundle entirely.

---

## 2. The data source: PSGC Cloud

**Base URL:** `https://psgc.cloud/api`
**Cost:** Free, no API key, no signup
**Source of truth:** Philippine Statistics Authority (PSA) PSGC releases
**Rate limits:** Returns `429 Too Many Requests` if exceeded (fine for normal form usage)

### Endpoints used

| Purpose | Endpoint | Notes |
|---|---|---|
| List all regions | `GET /api/regions` | Fields: `code`, `name` |
| Provinces under a region | `GET /api/regions/{region_code}/provinces` | **Empty array for NCR** — it has no provinces |
| Cities/municipalities under a region and/or province | `GET /api/v1/cities-municipalities?region_code=X&province_code=Y` | `province_code` optional — omit for NCR-style regions |
| Barangays under a city/municipality | `GET /api/v1/cities-municipalities/{city_code}/barangays` | Fields: `code`, `name`, `status` |

### The NCR gotcha

Metro Manila (NCR) has **no provinces** — its cities (Manila, Quezon City, Makati, etc.) sit directly under the region. Any implementation that assumes region → province → city will break for NCR unless you handle this case explicitly. This guide's approach: fetch cities by `region_code` alone when no province is selected, so the flow degrades gracefully instead of dead-ending.

---

## 3. Data flow / architecture

```
On mount
  └─ GET /api/regions ──────────────────────────► populate Region <select>

On Region change
  ├─ GET /api/regions/{region}/provinces ───────► populate Province <select>
  │     (empty result is valid — e.g. NCR)
  └─ GET /api/v1/cities-municipalities
        ?region_code={region} ───────────────────► populate City <select>
  reset Province, City, Barangay selections

On Province change
  └─ GET /api/v1/cities-municipalities
        ?region_code={region}&province_code={province} ──► re-populate City <select>
  reset City, Barangay selections

On City change
  └─ GET /api/v1/cities-municipalities/{city}/barangays ─► populate Barangay <select>
  reset Barangay selection

On Barangay change
  └─ notify parent via onChange({ region, province, city, barangay })
```

Each level only fetches once its parent is known, and changing a parent always clears everything below it — this is what prevents mismatched combinations (e.g. a Cebu barangay showing up under a Manila city).

---

## 4. Prerequisites

- React 18+ (hooks: `useState`, `useEffect`, `useCallback`)
- No extra npm packages required — uses native `fetch`
- No environment variables, no API key

```bash
# Nothing to install beyond React itself
```

---

## 5. Full component code

Save as `AddressDropdown.jsx`:

```jsx
import { useState, useEffect, useCallback } from "react";

const API = "https://psgc.cloud/api";

// Normalize response shape: some endpoints return a bare array,
// others wrap it as { data: [...] }
async function fetchList(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : json.data ?? [];
}

export default function AddressDropdown({ onChange }) {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [regionCode, setRegionCode] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [cityCode, setCityCode] = useState("");
  const [barangayCode, setBarangayCode] = useState("");

  const [loading, setLoading] = useState({
    regions: false,
    provinces: false,
    cities: false,
    barangays: false,
  });
  const [error, setError] = useState(null);

  const setStage = (key, val) =>
    setLoading((prev) => ({ ...prev, [key]: val }));

  // 1. Regions — load once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStage("regions", true);
      setError(null);
      try {
        const data = await fetchList(`${API}/regions`);
        if (!cancelled) setRegions(data);
      } catch {
        if (!cancelled) setError("Couldn't load regions. Check your connection and retry.");
      } finally {
        if (!cancelled) setStage("regions", false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 2. Provinces — depends on region
  useEffect(() => {
    if (!regionCode) { setProvinces([]); return; }
    let cancelled = false;
    (async () => {
      setStage("provinces", true);
      setError(null);
      try {
        const data = await fetchList(`${API}/regions/${regionCode}/provinces`);
        if (!cancelled) setProvinces(data);
      } catch {
        if (!cancelled) setError("Couldn't load provinces. Check your connection and retry.");
      } finally {
        if (!cancelled) setStage("provinces", false);
      }
    })();
    return () => { cancelled = true; };
  }, [regionCode]);

  // 3. Cities/municipalities — depends on region (+ province if present)
  useEffect(() => {
    if (!regionCode) { setCities([]); return; }
    let cancelled = false;
    (async () => {
      setStage("cities", true);
      setError(null);
      try {
        const params = new URLSearchParams({ region_code: regionCode });
        if (provinceCode) params.set("province_code", provinceCode);
        const data = await fetchList(`${API}/v1/cities-municipalities?${params}`);
        if (!cancelled) setCities(data);
      } catch {
        if (!cancelled) setError("Couldn't load cities/municipalities. Check your connection and retry.");
      } finally {
        if (!cancelled) setStage("cities", false);
      }
    })();
    return () => { cancelled = true; };
  }, [regionCode, provinceCode]);

  // 4. Barangays — depends on city
  useEffect(() => {
    if (!cityCode) { setBarangays([]); return; }
    let cancelled = false;
    (async () => {
      setStage("barangays", true);
      setError(null);
      try {
        const data = await fetchList(`${API}/v1/cities-municipalities/${cityCode}/barangays`);
        if (!cancelled) setBarangays(data);
      } catch {
        if (!cancelled) setError("Couldn't load barangays. Check your connection and retry.");
      } finally {
        if (!cancelled) setStage("barangays", false);
      }
    })();
    return () => { cancelled = true; };
  }, [cityCode]);

  // Report full selection upward
  useEffect(() => {
    if (!onChange) return;
    onChange({
      region: regions.find((r) => r.code === regionCode) ?? null,
      province: provinces.find((p) => p.code === provinceCode) ?? null,
      city: cities.find((c) => c.code === cityCode) ?? null,
      barangay: barangays.find((b) => b.code === barangayCode) ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionCode, provinceCode, cityCode, barangayCode]);

  const handleRegion = useCallback((e) => {
    setRegionCode(e.target.value);
    setProvinceCode(""); setCityCode(""); setBarangayCode("");
  }, []);

  const handleProvince = useCallback((e) => {
    setProvinceCode(e.target.value);
    setCityCode(""); setBarangayCode("");
  }, []);

  const handleCity = useCallback((e) => {
    setCityCode(e.target.value);
    setBarangayCode("");
  }, []);

  const handleBarangay = useCallback((e) => {
    setBarangayCode(e.target.value);
  }, []);

  const selectStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 6,
    border: "1px solid #d0d0d0", fontSize: 14, background: "#fff",
  };
  const labelStyle = { display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 };
  const fieldWrap = { marginBottom: 14 };

  return (
    <div style={{ maxWidth: 420, fontFamily: "sans-serif" }}>
      {error && (
        <div style={{ marginBottom: 12, padding: "8px 10px", background: "#fdecea", color: "#a33", borderRadius: 6, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={fieldWrap}>
        <label style={labelStyle}>Region</label>
        <select style={selectStyle} value={regionCode} onChange={handleRegion} disabled={loading.regions}>
          <option value="">{loading.regions ? "Loading regions..." : "Select region"}</option>
          {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
        </select>
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>Province</label>
        <select
          style={selectStyle}
          value={provinceCode}
          onChange={handleProvince}
          disabled={!regionCode || loading.provinces || provinces.length === 0}
        >
          <option value="">
            {!regionCode ? "Select a region first"
              : loading.provinces ? "Loading provinces..."
              : provinces.length === 0 ? "No provinces (e.g. NCR) — pick city/municipality directly"
              : "Select province"}
          </option>
          {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>City / Municipality</label>
        <select style={selectStyle} value={cityCode} onChange={handleCity} disabled={!regionCode || loading.cities}>
          <option value="">{loading.cities ? "Loading cities..." : "Select city or municipality"}</option>
          {cities.map((c) => (
            <option key={c.code} value={c.code}>{c.name}{c.type ? ` (${c.type})` : ""}</option>
          ))}
        </select>
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>Barangay</label>
        <select style={selectStyle} value={barangayCode} onChange={handleBarangay} disabled={!cityCode || loading.barangays}>
          <option value="">{loading.barangays ? "Loading barangays..." : "Select barangay"}</option>
          {barangays.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
      </div>
    </div>
  );
}
```

---

## 6. Usage

```jsx
import AddressDropdown from "./AddressDropdown";

function PatientForm() {
  const handleAddressChange = (address) => {
    // address = { region, province, city, barangay }
    // each is either null or { code, name, ... }
    console.log(address);
  };

  return (
    <form>
      <AddressDropdown onChange={handleAddressChange} />
    </form>
  );
}
```

The `onChange` callback fires on every selection change, even partial ones (e.g. only region selected). Check for `null` on fields the user hasn't reached yet before submitting.

---

## 7. Error handling notes

- Every fetch stage (`regions`, `provinces`, `cities`, `barangays`) tracks its own `loading` flag, so only the relevant `<select>` shows a "Loading..." state.
- A failed request sets a single shared `error` message rather than one per field, since only one request is realistically in flight at a time in a cascading UI.
- The `cancelled` flag inside each `useEffect` prevents a slow, stale request from overwriting state after the user has already moved to a different selection (a classic race condition in cascading dropdowns).
- Empty province list is treated as a **valid, expected state** for NCR — not an error.

---

## 8. Testing checklist

- [ ] Select a region with provinces (e.g. Region III) — province list populates, then city list populates after province is picked.
- [ ] Select NCR — province field disables with the explanatory placeholder, city list populates directly from the region.
- [ ] Change region after selecting province/city/barangay — confirm all downstream fields reset.
- [ ] Change province after selecting city/barangay — confirm city/barangay reset.
- [ ] Simulate offline (dev tools → Network → Offline) — confirm the error banner appears and the affected `<select>` doesn't silently stay empty without explanation.
- [ ] Rapidly switch regions before provinces finish loading — confirm no stale data flashes in (tests the `cancelled` guard).

---

## 9. Deployment considerations

- **CORS**: PSGC Cloud serves public JSON with permissive CORS, so this works from any origin including `localhost` during development.
- **Uptime dependency**: This wires your form to a third-party wrapper around PSA data, not PSA's own endpoint. For anything mission-critical (e.g. a hospital EMR intake form), consider caching responses client-side (`localStorage` or a small in-memory cache keyed by `region_code`/`province_code`) to reduce repeated calls and soften the impact of any downtime.
- **No API key to leak**: safe to call directly from the browser; no backend proxy required.

---

## 10. Offline alternative (if uptime is critical)

If you'd rather not depend on any external service at runtime, `ph-address` (npm) ships the full PSGC dataset as a local SQLite/JSON file with a built-in search function — zero network calls, fully free, immune to third-party downtime. Trade-off: you own re-syncing it against PSA's quarterly releases yourself.

```bash
npm install ph-address
```

Use this route only if your uptime requirements justify the added maintenance burden of manually refreshing the dataset.

---

## References

- PSGC Cloud API docs: https://psgc.cloud/api-docs
- PSA official PSGC page (source of truth): https://psa.gov.ph/classification/psgc
- `ph-address` (offline alternative): https://github.com/kosinix/ph-address