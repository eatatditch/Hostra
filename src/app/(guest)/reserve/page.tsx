"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatTime12h } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { Calendar, Clock, Users, Check, MapPin, Phone, Globe, Navigation, Waves } from "lucide-react";

type Step = "location" | "details" | "time" | "confirm" | "done";

/* ── Surfer on wave SVG ── */
function SurferWave({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1440 200" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      {/* Deep wave */}
      <path d="M0,120 C180,180 360,60 540,120 C720,180 900,40 1080,100 C1200,140 1320,80 1440,120 L1440,200 L0,200 Z" fill="#325269" opacity="0.12" />
      {/* Mid wave */}
      <path d="M0,140 C240,80 480,180 720,120 C960,60 1200,160 1440,100 L1440,200 L0,200 Z" fill="#325269" opacity="0.08" />
      {/* Light wave */}
      <path d="M0,160 C360,120 720,180 1080,140 C1260,120 1380,160 1440,150 L1440,200 L0,200 Z" fill="#547352" opacity="0.06" />
      {/* Surfer */}
      <g transform="translate(680, 72) scale(0.55)" fill="#cd6028">
        {/* Surfboard */}
        <ellipse cx="0" cy="28" rx="42" ry="5" fill="#cd6028" opacity="0.9" transform="rotate(-8)" />
        {/* Body */}
        <circle cx="0" cy="-8" r="7" /> {/* Head */}
        <path d="M0,-1 L-3,18 L3,18 Z" /> {/* Torso */}
        {/* Arms out for balance */}
        <line x1="-3" y1="2" x2="-22" y2="-8" stroke="#cd6028" strokeWidth="3" strokeLinecap="round" />
        <line x1="3" y1="2" x2="24" y2="-4" stroke="#cd6028" strokeWidth="3" strokeLinecap="round" />
        {/* Legs */}
        <line x1="-2" y1="18" x2="-6" y2="28" stroke="#cd6028" strokeWidth="3" strokeLinecap="round" />
        <line x1="2" y1="18" x2="8" y2="26" stroke="#cd6028" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function BottomWave({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1440 160" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <path d="M0,40 C240,100 480,0 720,60 C960,120 1200,20 1440,80 L1440,0 L0,0 Z" fill="#325269" opacity="0.08" />
      <path d="M0,60 C360,0 720,80 1080,20 C1260,0 1380,40 1440,30 L1440,0 L0,0 Z" fill="#547352" opacity="0.05" />
    </svg>
  );
}

function ContactInfo({ location, brand, compact }: { location: any; brand: any; compact?: boolean }) {
  if (!location) return null;
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1.5 ${compact ? "text-xs" : "text-sm"}`}>
      {location.address && (
        <span className="flex items-center gap-1 text-ditch-blue-dark/60">
          <MapPin className="h-3.5 w-3.5" />
          {location.address}
        </span>
      )}
      {location.phone && (
        <a href={`tel:${location.phone}`} className="flex items-center gap-1 text-ditch-blue-dark/60 hover:text-ditch-blue transition-colors">
          <Phone className="h-3.5 w-3.5" />
          {location.phone}
        </a>
      )}
      {location.address && (
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-ditch-orange hover:text-ditch-orange-dark transition-colors font-medium">
          <Navigation className="h-3.5 w-3.5" />
          Directions
        </a>
      )}
      {brand?.website_url && (
        <a href={brand.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-ditch-orange hover:text-ditch-orange-dark transition-colors font-medium">
          <Globe className="h-3.5 w-3.5" />
          Website
        </a>
      )}
    </div>
  );
}

export default function ReservePage() {
  const [step, setStep] = useState<Step>("location");
  const [locationId, setLocationId] = useState("");
  const [locationName, setLocationName] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [partySize, setPartySize] = useState(2);
  const [selectedTime, setSelectedTime] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [confirmationToken, setConfirmationToken] = useState("");

  const { data: brand } = trpc.table.getBrandSettings.useQuery();
  const { data: publicLocations, isLoading: locationsLoading } =
    trpc.table.getPublicLocations.useQuery(undefined, { enabled: step === "location" });
  const selectedLocation = publicLocations?.find((l: any) => l.id === locationId);
  const { data: slots, isLoading: slotsLoading } =
    trpc.reservation.getAvailability.useQuery(
      { locationId, date, partySize },
      { enabled: !!locationId && (step === "time" || step === "details") }
    );
  const createMutation = trpc.reservation.create.useMutation();

  function handleSelectLocation(id: string, name: string) { setLocationId(id); setLocationName(name); setStep("details"); }
  function handleSelectDateParty() { setStep("time"); }
  function handleSelectTime(time: string) { setSelectedTime(time); setStep("confirm"); }
  async function handleConfirm() {
    const result = await createMutation.mutateAsync({
      locationId, firstName, lastName: lastName || undefined, phone,
      email: email || undefined, date, time: selectedTime, partySize,
      specialRequests: specialRequests || undefined,
    });
    setConfirmationToken(result.token);
    setStep("done");
  }

  const minDate = format(new Date(), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 30), "yyyy-MM-dd");

  const inputClass = "w-full px-4 py-3 rounded-xl border border-ditch-sand-dark bg-white/90 text-ditch-charcoal placeholder:text-ditch-blue-dark/30 focus:outline-none focus:ring-2 focus:ring-ditch-orange/30 focus:border-ditch-orange transition-all text-sm";

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "linear-gradient(180deg, #e8f0f4 0%, #f5f0e8 30%, #faf8f5 60%, #f0ebe3 100%)" }}>
      {/* Top waves with surfer */}
      <div className="absolute top-0 left-0 right-0">
        <SurferWave className="w-full h-44 sm:h-52" />
      </div>

      {/* Bottom waves */}
      <div className="absolute bottom-0 left-0 right-0">
        <BottomWave className="w-full h-32" />
      </div>

      {/* Sand texture dots */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, #8B7355 1px, transparent 1px)", backgroundSize: "16px 16px" }} />

      <div className="relative z-10 flex items-start justify-center pt-48 sm:pt-56 px-4 pb-24">
        <div className="w-full max-w-md">

          {/* Brand Header */}
          <div className="text-center mb-10">
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt={brand.brand_name || "Ditch"} className="h-16 mx-auto mb-2" />
            ) : (
              <h1 className="text-5xl sm:text-6xl font-display font-bold tracking-tight" style={{ color: "#2a2a2a" }}>
                {brand?.brand_name || "Ditch"}
              </h1>
            )}
            <p className="text-xs tracking-[0.25em] uppercase font-semibold mt-3" style={{ color: "#325269", opacity: 0.5 }}>
              Kitchen & Surf Bar
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <div className="h-px w-12 bg-ditch-orange/30" />
              <p className="text-sm font-display italic" style={{ color: "#cd6028" }}>
                Reserve a Table
              </p>
              <div className="h-px w-12 bg-ditch-orange/30" />
            </div>
          </div>

          {/* Step: Location */}
          {step === "location" && (
            <div className="space-y-4">
              <h2 className="text-center text-lg font-display text-ditch-charcoal">
                Where are you dining?
              </h2>
              {locationsLoading ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-28 bg-white/40 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : !publicLocations || publicLocations.length === 0 ? (
                <p className="text-center py-8 text-ditch-blue-dark/50">No locations available.</p>
              ) : (
                <div className="space-y-3">
                  {publicLocations.map((loc: any) => (
                    <button
                      key={loc.id}
                      onClick={() => handleSelectLocation(loc.id, loc.name)}
                      className="w-full text-left p-5 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/50 shadow-sm hover:shadow-lg hover:bg-white/90 hover:border-ditch-orange/20 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-display font-semibold text-lg text-ditch-charcoal group-hover:text-ditch-orange transition-colors">
                            {loc.name}
                          </div>
                          {loc.address && (
                            <p className="text-sm text-ditch-blue-dark/50 mt-1 flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" /> {loc.address}
                            </p>
                          )}
                          {loc.phone && (
                            <p className="text-sm text-ditch-blue-dark/50 mt-0.5 flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" /> {loc.phone}
                            </p>
                          )}
                        </div>
                        <span className="text-ditch-orange text-2xl opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">&rsaquo;</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Date & Party Size */}
          {step === "details" && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 shadow-sm p-6 space-y-5">
              <button type="button" onClick={() => setStep("location")} className="text-sm text-ditch-orange hover:text-ditch-orange-dark transition-colors cursor-pointer font-medium">
                &larr; Change location
              </button>
              <div className="rounded-xl p-4 space-y-2.5" style={{ background: "linear-gradient(135deg, rgba(50,82,105,0.06), rgba(84,115,82,0.04))" }}>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-ditch-blue" />
                  <span className="font-display font-semibold text-ditch-charcoal">{locationName}</span>
                </div>
                <ContactInfo location={selectedLocation} brand={brand} compact />
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleSelectDateParty(); }} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-ditch-charcoal/80 mb-2">When?</label>
                  <input type="date" value={date} min={minDate} max={maxDate} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ditch-charcoal/80 mb-2">How many guests?</label>
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <button key={n} type="button" onClick={() => setPartySize(n)}
                        className={`w-11 h-11 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer ${
                          partySize === n
                            ? "text-white border-ditch-orange shadow-md scale-110"
                            : "bg-white/80 border-ditch-sand-dark text-ditch-charcoal hover:border-ditch-orange/40"
                        }`}
                        style={partySize === n ? { background: "linear-gradient(135deg, #cd6028, #a84d1f)" } : {}}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" className="w-full py-3.5 rounded-xl text-white font-semibold text-lg shadow-md hover:shadow-lg transition-all cursor-pointer" style={{ background: "linear-gradient(135deg, #cd6028, #a84d1f)" }}>
                  Find Available Times
                </button>
              </form>
            </div>
          )}

          {/* Step: Time Selection */}
          {step === "time" && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 shadow-sm p-6 space-y-5">
              <button onClick={() => setStep("details")} className="text-sm text-ditch-orange hover:text-ditch-orange-dark transition-colors cursor-pointer font-medium">
                &larr; Back
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { icon: MapPin, text: locationName },
                  { icon: Calendar, text: format(new Date(date + "T00:00:00"), "EEE, MMM d") },
                  { icon: Users, text: `${partySize} ${partySize === 1 ? "guest" : "guests"}` },
                ].map((item, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: "rgba(50,82,105,0.07)", color: "#325269" }}>
                    <item.icon className="h-3.5 w-3.5" /> {item.text}
                  </span>
                ))}
              </div>
              <h3 className="font-display text-ditch-charcoal text-lg">Pick your time</h3>
              {slotsLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(6)].map((_, i) => (<div key={i} className="h-12 bg-ditch-sand/30 rounded-xl animate-pulse" />))}
                </div>
              ) : slots?.filter((s) => s.available).length === 0 ? (
                <div className="text-center py-10">
                  <Waves className="h-10 w-10 mx-auto mb-3" style={{ color: "rgba(50,82,105,0.15)" }} />
                  <p className="text-ditch-blue-dark/50">No times available for this date.</p>
                  <button onClick={() => setStep("details")} className="text-sm text-ditch-orange hover:underline mt-2 cursor-pointer">Try a different date</button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots?.filter((s) => s.available).map((slot) => (
                    <button key={slot.time} onClick={() => handleSelectTime(slot.time)}
                      className="py-3 rounded-xl border-2 border-ditch-sand-dark/60 bg-white/80 text-sm font-semibold text-ditch-charcoal hover:text-white hover:border-ditch-orange hover:scale-105 transition-all cursor-pointer"
                      style={{ ["--tw-hover-bg" as any]: "#cd6028" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, #cd6028, #a84d1f)"; e.currentTarget.style.color = "white"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ""; e.currentTarget.style.color = ""; }}
                    >
                      {formatTime12h(slot.time)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Contact & Confirm */}
          {step === "confirm" && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 shadow-sm p-6">
              <form onSubmit={(e) => { e.preventDefault(); handleConfirm(); }} className="space-y-5">
                <button type="button" onClick={() => setStep("time")} className="text-sm text-ditch-orange hover:text-ditch-orange-dark transition-colors cursor-pointer font-medium">&larr; Back</button>
                <div className="rounded-xl p-4 space-y-2" style={{ background: "linear-gradient(135deg, rgba(50,82,105,0.06), rgba(84,115,82,0.04))" }}>
                  <div className="font-display font-semibold text-ditch-charcoal flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-ditch-blue" /> {locationName}
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-ditch-blue-dark/60">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {format(new Date(date + "T00:00:00"), "EEEE, MMM d")}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatTime12h(selectedTime)}</span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {partySize} {partySize === 1 ? "guest" : "guests"}</span>
                  </div>
                  <ContactInfo location={selectedLocation} brand={brand} compact />
                </div>
                <h3 className="font-display text-ditch-charcoal text-lg">Your details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-ditch-charcoal/60 mb-1">First Name</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputClass} /></div>
                  <div><label className="block text-xs font-semibold text-ditch-charcoal/60 mb-1">Last Name</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} /></div>
                </div>
                <div><label className="block text-xs font-semibold text-ditch-charcoal/60 mb-1">Phone</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" required className={inputClass} /></div>
                <div><label className="block text-xs font-semibold text-ditch-charcoal/60 mb-1">Email <span className="opacity-40">(optional)</span></label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} /></div>
                <div><label className="block text-xs font-semibold text-ditch-charcoal/60 mb-1">Special Requests <span className="opacity-40">(optional)</span></label><textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Allergies, celebrations, seating preferences..." className={`${inputClass} min-h-[70px] resize-y`} /></div>
                {createMutation.error && (
                  <p className="text-sm text-white text-center p-2 rounded-xl" style={{ background: "rgba(192,57,43,0.8)" }}>
                    {createMutation.error.message === "SLOT_UNAVAILABLE" ? "This time slot is no longer available."
                      : createMutation.error.message === "DUPLICATE_RESERVATION" ? "You already have a reservation for this date."
                      : "Something went wrong. Please try again."}
                  </p>
                )}
                <button type="submit" disabled={createMutation.isPending}
                  className="w-full py-3.5 rounded-xl text-white font-semibold text-lg shadow-md hover:shadow-lg disabled:opacity-50 transition-all cursor-pointer"
                  style={{ background: "linear-gradient(135deg, #cd6028, #a84d1f)" }}
                >
                  {createMutation.isPending ? "Confirming..." : "Confirm Reservation"}
                </button>
              </form>
            </div>
          )}

          {/* Step: Confirmation */}
          {step === "done" && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 shadow-sm p-8 text-center space-y-6">
              <div>
                <div className="h-20 w-20 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(84,115,82,0.12)" }}>
                  <Check className="h-10 w-10 text-ditch-green" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-display font-bold text-ditch-charcoal">See you there!</h2>
                <p className="text-sm mt-1" style={{ color: "rgba(50,82,105,0.5)" }}>Your table is reserved.</p>
              </div>
              <div className="rounded-xl p-5 space-y-3 text-left border" style={{ background: "linear-gradient(135deg, rgba(50,82,105,0.04), rgba(84,115,82,0.04))", borderColor: "rgba(232,223,210,0.6)" }}>
                <div className="font-display font-semibold text-ditch-charcoal text-lg">{locationName}</div>
                <div className="flex flex-wrap gap-4 text-sm" style={{ color: "rgba(50,82,105,0.6)" }}>
                  <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-ditch-blue" /> {format(new Date(date + "T00:00:00"), "EEEE, MMMM d")}</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-ditch-blue" /> {formatTime12h(selectedTime)}</span>
                  <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-ditch-blue" /> Party of {partySize}</span>
                </div>
                <div className="pt-3 border-t" style={{ borderColor: "rgba(232,223,210,0.5)" }}>
                  <ContactInfo location={selectedLocation} brand={brand} compact />
                </div>
              </div>
              <p className="text-sm" style={{ color: "rgba(50,82,105,0.4)" }}>A confirmation has been sent to your phone.</p>
              <a href={`/booking/${confirmationToken}`} className="inline-block text-sm font-semibold text-ditch-orange hover:text-ditch-orange-dark transition-colors">
                View or modify your reservation &rarr;
              </a>
            </div>
          )}

          {/* Footer */}
          <p className="text-center mt-10 text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(50,82,105,0.2)" }}>
            Powered by HostOS
          </p>
        </div>
      </div>
    </div>
  );
}
