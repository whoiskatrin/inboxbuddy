interface ToastProps {
  message: string;
}

export function Toast({ message }: ToastProps) {
  return (
    <div className="toast toast-success show">
      {message}
    </div>
  );
}
