import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export function useImageUploadFlow({
  errorMessage,
  onUpload,
  successMessage,
}: {
  errorMessage: string;
  onUpload: (file: File) => Promise<void>;
  successMessage: string;
}) {
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: onUpload,
    onSuccess: () => {
      toast.success(successMessage);
      setIsCropOpen(false);
      setCropFile(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : errorMessage);
    },
  });

  return {
    cropFile,
    isCropOpen,
    isManageModalOpen,
    isPending: uploadMutation.isPending,
    isUploadModalOpen,
    openManageModal: () => setIsManageModalOpen(true),
    openUploadModal: () => setIsUploadModalOpen(true),
    closeManageModal: () => setIsManageModalOpen(false),
    closeUploadModal: () => setIsUploadModalOpen(false),
    handlePickFile: (file: File) => {
      setCropFile(file);
      setIsManageModalOpen(false);
      setIsUploadModalOpen(false);
      setIsCropOpen(true);
    },
    handleCloseCrop: () => {
      setIsCropOpen(false);
      setCropFile(null);
    },
    handleSaveCrop: async (file: File) => {
      await uploadMutation.mutateAsync(file);
    },
  };
}
