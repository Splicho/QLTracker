"use client";

import { useState } from "react";

import { Field } from "@/components/pickup-admin-fields";
import {
  Button,
  Input,
  Spinner,
  toast,
} from "@/components/pickup-admin-ui";
import { requestJson } from "@/lib/client/request-json";
import type { PickupAdminSettingsDto, PickupSettingsDto } from "@/lib/server/pickup";

type SettingsFormState = {
  callbackSecret: string;
  provisionApiUrl: string;
  provisionAuthToken: string;
  readyCheckDurationSeconds: number;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2BucketName: string;
  r2PublicBaseUrl: string;
  r2SecretAccessKey: string;
  vetoTurnDurationSeconds: number;
};

function createForm(settings: PickupSettingsDto): SettingsFormState {
  return {
    callbackSecret: "",
    provisionApiUrl: settings.provisionApiUrl ?? "",
    provisionAuthToken: "",
    readyCheckDurationSeconds: settings.readyCheckDurationSeconds,
    r2AccountId: settings.r2AccountId ?? "",
    r2AccessKeyId: "",
    r2BucketName: settings.r2BucketName ?? "",
    r2PublicBaseUrl: settings.r2PublicBaseUrl ?? "",
    r2SecretAccessKey: "",
    vetoTurnDurationSeconds: settings.vetoTurnDurationSeconds,
  };
}

export function PickupAdminSettings({
  initialSettings,
}: {
  initialSettings: PickupAdminSettingsDto;
}) {
  const [settings, setSettings] = useState(initialSettings.settings);
  const [form, setForm] = useState(createForm(initialSettings.settings));
  const [isPending, setIsPending] = useState(false);

  const saveSettings = () => {
    setIsPending(true);
    void requestJson<{ settings: PickupSettingsDto }>("/api/pickup/admin/settings", {
      body: JSON.stringify(form),
      method: "PATCH",
    })
      .then((payload) => {
        setSettings(payload.settings);
        setForm(createForm(payload.settings));
        toast.success("Shared pickup settings saved.");
      })
      .catch((error) => {
        toast.danger("Shared settings failed.", {
          description: error instanceof Error ? error.message : "Request failed.",
        });
      })
      .finally(() => {
        setIsPending(false);
      });
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10 text-white">
      <header className="space-y-1">
        <h1 className="text-3xl font-medium tracking-tight">Settings</h1>
        <p className="text-sm text-white/60">
          These settings apply to every queue. Change them once and the full pickup flow updates
          together.
        </p>
      </header>

      <section>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d0d]">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-xl font-medium">Match Flow Configuration</h2>
            <p className="mt-2 text-sm text-white/60">
              Timers and provision credentials are shared globally so queues only own queue-specific
              data like format, map pool, and seasons.
            </p>
          </div>

          <div className="grid gap-5 px-6 py-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Ready check seconds">
                <Input
                  min={10}
                  type="number"
                  value={String(form.readyCheckDurationSeconds)}
                  variant="secondary"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      readyCheckDurationSeconds: Number(event.target.value) || 0,
                    }))
                  }
                />
              </Field>
              <Field label="Veto turn seconds">
                <Input
                  min={10}
                  type="number"
                  value={String(form.vetoTurnDurationSeconds)}
                  variant="secondary"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      vetoTurnDurationSeconds: Number(event.target.value) || 0,
                    }))
                  }
                />
              </Field>
            </div>

            <Field
              description="Realtime calls this endpoint after captains finish the veto."
              label="Provision API URL"
            >
              <Input
                placeholder="https://..."
                value={form.provisionApiUrl}
                variant="secondary"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    provisionApiUrl: event.target.value,
                  }))
                }
              />
            </Field>

            <Field
              description={
                settings.hasProvisionAuthToken
                  ? "A token is already stored. Enter a new one only when rotating it."
                  : "Optional bearer token sent to the provision API."
              }
              label="Provision auth token"
            >
              <Input
                placeholder={settings.hasProvisionAuthToken ? "stored" : "optional"}
                value={form.provisionAuthToken}
                variant="secondary"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    provisionAuthToken: event.target.value,
                  }))
                }
              />
            </Field>

            <Field
              description={
                settings.hasCallbackSecret
                  ? "A callback secret is already stored. Enter a new one only when rotating it."
                  : "Used to verify provisioned and match-result callbacks."
              }
              label="Callback secret"
            >
              <Input
                placeholder={settings.hasCallbackSecret ? "stored" : "optional"}
                value={form.callbackSecret}
                variant="secondary"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    callbackSecret: event.target.value,
                  }))
                }
              />
            </Field>

            <div className="rounded-3xl border border-white/10 bg-[#101010] p-5">
              <div className="space-y-1">
                <h3 className="text-base font-medium">Cloudflare R2</h3>
                <p className="text-sm text-white/60">
                  News cover images and inline content images upload through this bucket.
                </p>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="R2 account ID">
                  <Input
                    placeholder="Cloudflare account ID"
                    value={form.r2AccountId}
                    variant="secondary"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        r2AccountId: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field label="Bucket name">
                  <Input
                    placeholder="qltracker-news"
                    value={form.r2BucketName}
                    variant="secondary"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        r2BucketName: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field
                  className="md:col-span-2"
                  description="Public base URL used to serve uploaded images."
                  label="Public base URL"
                >
                  <Input
                    placeholder="https://cdn.example.com"
                    value={form.r2PublicBaseUrl}
                    variant="secondary"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        r2PublicBaseUrl: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field
                  description={
                    settings.hasR2AccessKeyId
                      ? "An access key is already stored. Enter a new one only when rotating it."
                      : "R2 access key ID for news uploads."
                  }
                  label="Access key ID"
                >
                  <Input
                    placeholder={settings.hasR2AccessKeyId ? "stored" : "required"}
                    value={form.r2AccessKeyId}
                    variant="secondary"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        r2AccessKeyId: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field
                  description={
                    settings.hasR2SecretAccessKey
                      ? "A secret key is already stored. Enter a new one only when rotating it."
                      : "R2 secret access key for news uploads."
                  }
                  label="Secret access key"
                >
                  <Input
                    placeholder={settings.hasR2SecretAccessKey ? "stored" : "required"}
                    type="password"
                    value={form.r2SecretAccessKey}
                    variant="secondary"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        r2SecretAccessKey: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end border-t border-white/10 pt-5">
              <Button isPending={isPending} variant="primary" onPress={saveSettings}>
                {({ isPending: buttonIsPending }) => (
                  <>
                    {buttonIsPending ? <Spinner color="current" size="sm" /> : null}
                    Save Shared Settings
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
