"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button, Input, Card } from "@/components/ui";
import { Check, Clock } from "lucide-react";
import { minutesToHumanReadable } from "@/lib/utils";

const LOCATION_ID = "00000000-0000-0000-0000-000000000001";

type Step = "join" | "done";

export default function WaitlistJoinPage() {
  const [step, setStep] = useState<Step>("join");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [checkToken, setCheckToken] = useState("");
  const [estimatedWait, setEstimatedWait] = useState(0);

  const joinMutation = trpc.waitlist.join.useMutation();

  async function handleJoin() {
    const result = await joinMutation.mutateAsync({
      locationId: LOCATION_ID,
      firstName,
      lastName: lastName || undefined,
      phone,
      partySize,
      source: "web",
    });
    setCheckToken(result.token);
    setEstimatedWait(result.entry.estimatedWaitMinutes || 0);
    setStep("done");
  }

  return (
    <div className="min-h-screen flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-ditch-charcoal">
            Ditch
          </h1>
          <p className="text-sm text-text-muted mt-1">Join the Waitlist</p>
        </div>

        {step === "join" && (
          <Card>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleJoin();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <Input
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <Input
                label="Phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                required
              />
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">
                  Party Size
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPartySize(n)}
                      className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                        partySize === n
                          ? "bg-primary text-white border-primary"
                          : "bg-white border-border text-text hover:border-primary"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {joinMutation.error && (
                <p className="text-sm text-status-error text-center">
                  {joinMutation.error.message === "ALREADY_ON_WAITLIST"
                    ? "You're already on the waitlist!"
                    : "Something went wrong. Please try again."}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={joinMutation.isPending}
              >
                Join Waitlist
              </Button>
            </form>
          </Card>
        )}

        {step === "done" && (
          <Card className="text-center">
            <div className="py-4 space-y-4">
              <div className="h-16 w-16 rounded-full bg-status-success/10 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-status-success" />
              </div>
              <h2 className="text-xl font-display font-bold">
                You&apos;re On the List!
              </h2>
              {estimatedWait > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
                  <Clock className="h-4 w-4" />
                  <span>
                    Estimated wait: ~{minutesToHumanReadable(estimatedWait)}
                  </span>
                </div>
              )}
              <p className="text-sm text-text-muted">
                We&apos;ll text you when your table is ready.
              </p>
              <a
                href={`/waitlist-status/${checkToken}`}
                className="text-sm text-primary hover:underline"
              >
                Check your status
              </a>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
