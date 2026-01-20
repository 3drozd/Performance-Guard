import { memo, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal = memo(function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
}: ModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay - solid color, no blur */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal content - instant appearance, no animation */}
      <div className={`relative w-full ${maxWidthStyles[maxWidth]} bg-bg-card rounded-xl border border-zinc-800 shadow-2xl`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-card-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
});
