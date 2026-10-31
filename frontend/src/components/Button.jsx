import { Link } from 'react-router';

import styles from './Button.module.css';

export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  icon: Icon,
  to,
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}) {
  const classes = [
    styles.button,
    styles[variant],
    size === 'sm' && styles.sm,
    block && styles.block,
    !children && styles.iconOnly,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {loading ? <span className="spinner" aria-hidden="true" /> : Icon && <Icon size={18} aria-hidden="true" />}
      {children && <span>{children}</span>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </button>
  );
}
