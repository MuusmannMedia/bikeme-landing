type AppAvatarProps = {
  name: string | null;
  url?: string | null;
  size?: "small" | "medium" | "large";
};

export function AppAvatar({ name, url, size = "medium" }: AppAvatarProps) {
  const initial = name?.trim().slice(0, 1).toLocaleUpperCase() || "B";

  return (
    <span className="bike-app-avatar" data-size={size} aria-hidden="true">
      {url ? (
        // User avatars are public Supabase Storage objects. Referrers are deliberately suppressed.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" referrerPolicy="no-referrer" />
      ) : initial}
    </span>
  );
}
