"use client";

import { useEffect, useMemo, useState } from "react";

import { ActionButton, Field, FieldTextArea } from "@/components/pickup-admin-fields";
import {
  Button,
  Input,
  Modal,
  toast,
  useOverlayState,
} from "@/components/pickup-admin-ui";
import { requestJson } from "@/lib/client/request-json";
import type { PickupNoticeDto } from "@/lib/server/notices";

type NoticeVariant = PickupNoticeDto["variant"];
type PendingAction = "create" | "update" | null;

const variantOptions: Array<{ label: string; value: NoticeVariant }> = [
  { label: "Success", value: "success" },
  { label: "Danger", value: "danger" },
  { label: "Alert", value: "alert" },
  { label: "Info", value: "info" },
];

type NoticeFormState = {
  content: string;
  dismissable: boolean;
  enabled: boolean;
  linkHref: string;
  linkLabel: string;
  variant: NoticeVariant;
};

function createDefaultForm(): NoticeFormState {
  return {
    content: "",
    dismissable: false,
    enabled: true,
    linkHref: "",
    linkLabel: "",
    variant: "info",
  };
}

function createFormFromNotice(notice: PickupNoticeDto): NoticeFormState {
  return {
    content: notice.content,
    dismissable: notice.dismissable,
    enabled: notice.enabled,
    linkHref: notice.linkHref ?? "",
    linkLabel: notice.linkLabel ?? "",
    variant: notice.variant,
  };
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export function PickupAdminNotices({
  initialNotices,
}: {
  initialNotices: PickupNoticeDto[];
}) {
  const [notices, setNotices] = useState(initialNotices);
  const [form, setForm] = useState<NoticeFormState>(createDefaultForm);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const modal = useOverlayState();

  const editingNotice = useMemo(
    () => notices.find((notice) => notice.id === editingNoticeId) ?? null,
    [editingNoticeId, notices],
  );

  useEffect(() => {
    if (!modal.isOpen) {
      setEditingNoticeId(null);
      setForm(createDefaultForm());
      return;
    }

    if (editingNotice) {
      setForm(createFormFromNotice(editingNotice));
      return;
    }

    setForm(createDefaultForm());
  }, [editingNotice, modal.isOpen]);

  const upsertLocalNotice = (notice: PickupNoticeDto) => {
    setNotices((current) =>
      [...current.filter((item) => item.id !== notice.id), notice].sort((left, right) => {
        if (left.enabled !== right.enabled) {
          return left.enabled ? -1 : 1;
        }

        return right.updatedAt.localeCompare(left.updatedAt);
      }),
    );
  };

  const submitNotice = async () => {
    const trimmedContent = form.content.trim();
    const trimmedHref = form.linkHref.trim();
    const trimmedLabel = form.linkLabel.trim();

    if (!trimmedContent) {
      toast.danger("Notice content is required.");
      return;
    }

    if ((trimmedHref && !trimmedLabel) || (!trimmedHref && trimmedLabel)) {
      toast.danger("Link URL and link label must be set together.");
      return;
    }

    const payload = {
      content: trimmedContent,
      dismissable: form.dismissable,
      enabled: form.enabled,
      linkHref: trimmedHref || null,
      linkLabel: trimmedLabel || null,
      variant: form.variant,
    };

    setPendingAction(editingNotice ? "update" : "create");

    try {
      if (editingNotice) {
        const response = await requestJson<{ notice: PickupNoticeDto }>(
          `/api/pickup/admin/notices/${encodeURIComponent(editingNotice.id)}`,
          {
            body: JSON.stringify(payload),
            method: "PATCH",
          },
        );

        upsertLocalNotice(response.notice);
        toast.success("Notice updated.");
      } else {
        const response = await requestJson<{ notice: PickupNoticeDto }>(
          "/api/pickup/admin/notices",
          {
            body: JSON.stringify(payload),
            method: "POST",
          },
        );

        upsertLocalNotice(response.notice);
        toast.success("Notice created.");
      }

      modal.close();
    } catch (error) {
      toast.danger(editingNotice ? "Notice update failed." : "Notice creation failed.", {
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setPendingAction(null);
    }
  };

  const openCreateModal = () => {
    setEditingNoticeId(null);
    modal.open();
  };

  const openEditModal = (noticeId: string) => {
    setEditingNoticeId(noticeId);
    modal.open();
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10 text-white">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-medium tracking-tight">Notices</h1>
          <p className="text-sm text-white/60">
            Manage launcher-wide notice bars shown above the full app shell.
          </p>
        </div>
        <Button className="h-11 cursor-pointer" variant="secondary" onPress={openCreateModal}>
          Create Notice
        </Button>
      </header>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d0d]">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-medium">Active and Draft Notices</h2>
          <p className="mt-1 text-sm text-white/60">
            Enabled notices are returned by the public notices API and shown in the launcher.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#111111] text-xs uppercase tracking-[0.18em] text-white/40">
              <tr>
                <th className="px-6 py-3 font-medium">Content</th>
                <th className="px-6 py-3 font-medium">Variant</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Dismissable</th>
                <th className="px-6 py-3 font-medium">Updated</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {notices.length ? (
                notices.map((notice) => (
                  <tr key={notice.id} className="border-t border-white/10">
                    <td className="px-6 py-4">
                      <div className="flex max-w-2xl flex-col gap-1">
                        <span className="font-medium text-white">{notice.content}</span>
                        {notice.linkHref && notice.linkLabel ? (
                          <span className="text-sm text-white/50">
                            {notice.linkLabel} {"->"} {notice.linkHref}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 capitalize text-white/70">{notice.variant}</td>
                    <td className="px-6 py-4 text-white/70">
                      {notice.enabled ? "Enabled" : "Disabled"}
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {notice.dismissable ? "Yes" : "No"}
                    </td>
                    <td className="px-6 py-4 text-white/70">{formatTimestamp(notice.updatedAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        className="cursor-pointer"
                        variant="secondary"
                        onPress={() => openEditModal(notice.id)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-6 py-5 text-white/55" colSpan={6}>
                    No notices yet. Create the first one from the button above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal state={modal}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog className="!max-w-4xl">
              <Modal.Header className="border-b border-white/10 px-6 py-4">
                <div>
                  <Modal.Heading className="text-xl font-medium">
                    {editingNotice ? "Edit Notice" : "Create Notice"}
                  </Modal.Heading>
                  <p className="mt-1 text-sm text-white/60">
                    Notices render above the sidebar, header, and page content in the launcher.
                  </p>
                </div>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field
                    className="lg:col-span-2"
                    description="Keep this concise because it spans the full launcher width."
                    label="Content"
                  >
                    <FieldTextArea
                      minRows={4}
                      placeholder="Scheduled maintenance starts in 30 minutes."
                      value={form.content}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          content: value,
                        }))
                      }
                    />
                  </Field>

                  <Field label="Variant">
                    <select
                      className="h-12 rounded-2xl border border-white/10 bg-transparent px-4 text-sm text-white outline-none transition focus:border-accent"
                      value={form.variant}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          variant: event.target.value as NoticeVariant,
                        }))
                      }
                    >
                      {variantOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="grid gap-4">
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#101010] px-4 py-3">
                      <input
                        checked={form.enabled}
                        className="h-4 w-4 accent-[#ff5f5f]"
                        type="checkbox"
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            enabled: event.target.checked,
                          }))
                        }
                      />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-white">Enabled</p>
                        <p className="text-xs text-white/50">
                          Enabled notices are returned to the launcher.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#101010] px-4 py-3">
                      <input
                        checked={form.dismissable}
                        className="h-4 w-4 accent-[#ff5f5f]"
                        type="checkbox"
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            dismissable: event.target.checked,
                          }))
                        }
                      />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-white">Dismissable</p>
                        <p className="text-xs text-white/50">
                          Users can close the notice locally in the launcher.
                        </p>
                      </div>
                    </label>
                  </div>

                  <Field
                    description="Optional. Add a URL only when the notice should link somewhere."
                    label="Link URL"
                  >
                    <Input
                      placeholder="https://status.example.com"
                      value={form.linkHref}
                      variant="secondary"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          linkHref: event.target.value,
                        }))
                      }
                    />
                  </Field>

                  <Field
                    description="Required only when a link URL is set."
                    label="Link label"
                  >
                    <Input
                      placeholder="View details"
                      value={form.linkLabel}
                      variant="secondary"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          linkLabel: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
                <Button className="cursor-pointer" variant="secondary" onPress={modal.close}>
                  Cancel
                </Button>
                <ActionButton
                  isDisabled={pendingAction !== null || form.content.trim().length === 0}
                  isPending={pendingAction !== null}
                  onPress={() => void submitNotice()}
                  variant="primary"
                >
                  {editingNotice ? "Save Notice" : "Create Notice"}
                </ActionButton>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
