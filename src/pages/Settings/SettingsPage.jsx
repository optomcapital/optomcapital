import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext.jsx'
import { Button, Card, ConfirmDialog, Input } from '../../components/ui/index.jsx'
import {
  challengeAndVerifyMfaFactor,
  enrollMfaFactor,
  listMfaFactors,
  supabase,
  supabaseConfigured,
  unenrollMfaFactor,
} from '../../lib/supabase.js'

const PasswordField = forwardRef(function PasswordField({ label, show, onToggle, error, ...props }, ref) {
  return (
    <div className="w-full">
      <div className="mb-1 text-[12px] font-medium text-text-secondary">{label}</div>
      <div className="relative">
        <input
          ref={ref}
          className={[
            'h-[34px] w-full rounded-md border border-border-input bg-surface px-3 pr-10 text-[13px] outline-none focus:border-accent',
            error ? 'border-danger focus:border-danger' : '',
          ].join(' ')}
          type={show ? 'text' : 'password'}
          autoComplete="off"
          {...props}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
          onClick={onToggle}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error ? <div className="mt-1 text-[12px] text-danger">{error}</div> : null}
    </div>
  )
})

function TwoFactorCard() {
  const [loadingFactors, setLoadingFactors] = useState(true)
  const [factors, setFactors] = useState([])
  const [enrollment, setEnrollment] = useState(null)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [unenrollTarget, setUnenrollTarget] = useState(null)

  const loadFactors = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoadingFactors(false)
      return
    }
    setLoadingFactors(true)
    try {
      const list = await listMfaFactors()
      setFactors(list)
    } catch (e) {
      toast.error(e?.message || 'Failed to load 2FA status')
    } finally {
      setLoadingFactors(false)
    }
  }, [])

  useEffect(() => {
    loadFactors()
  }, [loadFactors])

  const verifiedFactor = factors.find((f) => f.status === 'verified')

  async function startEnroll() {
    setEnrolling(true)
    try {
      const data = await enrollMfaFactor()
      setEnrollment(data)
    } catch (e) {
      toast.error(e?.message || 'Failed to start 2FA enrollment')
    } finally {
      setEnrolling(false)
    }
  }

  async function verifyEnrollment() {
    if (!enrollment?.id) return
    setVerifying(true)
    try {
      await challengeAndVerifyMfaFactor(enrollment.id, code.trim())
      toast.success('Two-factor authentication enabled')
      setEnrollment(null)
      setCode('')
      await loadFactors()
    } catch (e) {
      toast.error(e?.message || 'Invalid code, please try again')
    } finally {
      setVerifying(false)
    }
  }

  async function cancelEnrollment() {
    if (enrollment?.id) {
      try {
        await unenrollMfaFactor(enrollment.id)
      } catch (e) {
        void e
      }
    }
    setEnrollment(null)
    setCode('')
  }

  if (!supabaseConfigured) {
    return (
      <Card title="Two-Factor Authentication">
        <div className="text-[13px] text-text-secondary">
          2FA is available once this app is connected to Supabase (guest mode has no server-side auth).
        </div>
      </Card>
    )
  }

  return (
    <Card title="Two-Factor Authentication">
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-border-divider bg-bg px-3 py-2 text-[12px] text-text-secondary">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" />
          <span>
            Adds a second step at sign-in using an authenticator app. Even someone with database access can&apos;t sign in
            as you without this code.
          </span>
        </div>

        {loadingFactors ? (
          <div className="text-[13px] text-text-secondary">Checking status…</div>
        ) : enrollment ? (
          <div className="space-y-3">
            <div className="text-[13px] text-text-secondary">
              Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password), then enter the 6-digit
              code it generates.
            </div>
            {enrollment.totp?.qr_code ? (
              <img src={enrollment.totp.qr_code} alt="2FA QR code" className="h-40 w-40 rounded-md border border-border-divider" />
            ) : null}
            {enrollment.totp?.secret ? (
              <div className="text-[12px] text-text-muted">
                Can&apos;t scan? Enter this key manually: <span className="font-mono">{enrollment.totp.secret}</span>
              </div>
            ) : null}
            <div className="max-w-[220px]">
              <Input
                label="6-digit code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={verifyEnrollment} disabled={verifying || code.trim().length < 6}>
                {verifying ? 'Verifying…' : 'Verify & Enable'}
              </Button>
              <Button variant="secondary" onClick={cancelEnrollment} disabled={verifying}>
                Cancel
              </Button>
            </div>
          </div>
        ) : verifiedFactor ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-text-primary">Enabled</div>
              <div className="text-[12px] text-text-secondary">Authenticator app is required at every sign-in.</div>
            </div>
            <Button variant="danger" onClick={() => setUnenrollTarget(verifiedFactor)}>
              Disable
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-text-primary">Not enabled</div>
              <div className="text-[12px] text-text-secondary">Your account only requires a password to sign in.</div>
            </div>
            <Button onClick={startEnroll} disabled={enrolling}>
              {enrolling ? 'Starting…' : 'Enable 2FA'}
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!unenrollTarget}
        title="Disable two-factor authentication?"
        description="Your account will only require a password to sign in. This is not recommended if credential exposure is a concern."
        confirmText="Disable"
        onClose={() => setUnenrollTarget(null)}
        onConfirm={async () => {
          try {
            await unenrollMfaFactor(unenrollTarget.id)
            toast.success('Two-factor authentication disabled')
            setUnenrollTarget(null)
            await loadFactors()
          } catch (e) {
            toast.error(e?.message || 'Failed to disable 2FA')
          }
        }}
      />
    </Card>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [showEmailPw, setShowEmailPw] = useState(false)

  const emailForm = useForm({
    defaultValues: {
      email: user?.email || '',
      current_password: '',
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  const newPassword = watch('new_password')

  useEffect(() => {
    emailForm.reset((prev) => ({
      ...prev,
      email: user?.email || '',
      current_password: '',
    }))
  }, [emailForm, user?.email])

  async function verifyCurrentPassword(password) {
    if (!supabaseConfigured) return
    const { error } = await supabase.auth.signInWithPassword({
      email: user?.email,
      password,
    })
    if (error) throw new Error('Current password is incorrect')
  }

  async function onChangeEmail(values) {
    try {
      const nextEmail = String(values.email || '').trim().toLowerCase()
      if (!nextEmail) {
        toast.error('Email is required')
        return
      }
      if (nextEmail === String(user?.email || '').trim().toLowerCase()) {
        toast.error('New email must be different from current email')
        return
      }

      if (!supabaseConfigured) {
        toast.success('Email updated (guest mode)')
        emailForm.reset({ email: nextEmail, current_password: '' })
        return
      }

      await verifyCurrentPassword(values.current_password)

      const { error } = await supabase.auth.updateUser({
        email: nextEmail,
      })
      if (error) throw error

      toast.success('Email update requested. Please verify from your inbox if confirmation is enabled.')
      emailForm.reset({ email: nextEmail, current_password: '' })
    } catch (e) {
      toast.error(e?.message || 'Failed to update email')
    }
  }

  async function onChangePassword(values) {
    try {
      if (!supabaseConfigured) {
        toast.success('Password updated (guest mode)')
        reset()
        return
      }

      await verifyCurrentPassword(values.current_password)

      const { error } = await supabase.auth.updateUser({
        password: values.new_password,
      })
      if (error) throw error

      toast.success('Password updated successfully')
      reset()
    } catch (e) {
      toast.error(e?.message || 'Failed to update password')
    }
  }

  return (
    <div className="space-y-6 max-w-[720px]">
      <div>
        <div className="text-[18px] font-semibold">Settings</div>
        <div className="text-[13px] text-text-secondary">Manage your account and credentials</div>
      </div>

      {/* Account Information */}
      <Card title="Account Information">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[12px] font-medium text-text-secondary mb-1">User ID / Email</div>
              <div className="h-[34px] flex items-center rounded-md border border-border-input bg-[#F5F5F3] px-3 text-[13px] text-text-primary">
                {user?.email || '—'}
              </div>
            </div>
            <div>
              <div className="text-[12px] font-medium text-text-secondary mb-1">Account Type</div>
              <div className="h-[34px] flex items-center rounded-md border border-border-input bg-[#F5F5F3] px-3 text-[13px] text-text-primary">
                {supabaseConfigured ? 'Supabase (Production)' : 'Guest Mode'}
              </div>
            </div>
          </div>
          <div>
            <div className="text-[12px] font-medium text-text-secondary mb-1">User UID</div>
            <div className="h-[34px] flex items-center rounded-md border border-border-input bg-[#F5F5F3] px-3 text-[13px] text-text-muted font-mono">
              {user?.id || '—'}
            </div>
          </div>
        </div>
      </Card>

      <TwoFactorCard />

      <Card title="Change Email">
        <form onSubmit={emailForm.handleSubmit(onChangeEmail)} className="space-y-4">
          <Input
            label="New Email"
            type="email"
            autoComplete="email"
            error={emailForm.formState.errors.email?.message}
            {...emailForm.register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email address',
              },
            })}
          />
          <PasswordField
            label="Current Password"
            show={showEmailPw}
            onToggle={() => setShowEmailPw((v) => !v)}
            error={emailForm.formState.errors.current_password?.message}
            {...emailForm.register('current_password', { required: 'Current password is required' })}
          />
          <div className="rounded-md border border-border-divider bg-bg px-3 py-2 text-[12px] text-text-secondary">
            If email confirmation is enabled in Supabase, the new email will become active only after verification.
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={emailForm.formState.isSubmitting}>
              {emailForm.formState.isSubmitting ? 'Updating…' : 'Update Email'}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Change Password">
        <form onSubmit={handleSubmit(onChangePassword)} className="space-y-4">
          <PasswordField
            label="Current Password"
            show={showCurrentPw}
            onToggle={() => setShowCurrentPw((v) => !v)}
            error={errors.current_password?.message}
            {...register('current_password', { required: 'Current password is required' })}
          />
          <PasswordField
            label="New Password"
            show={showNewPw}
            onToggle={() => setShowNewPw((v) => !v)}
            error={errors.new_password?.message}
            {...register('new_password', {
              required: 'New password is required',
              minLength: { value: 6, message: 'Minimum 6 characters' },
            })}
          />
          <PasswordField
            label="Confirm New Password"
            show={showConfirmPw}
            onToggle={() => setShowConfirmPw((v) => !v)}
            error={errors.confirm_password?.message}
            {...register('confirm_password', {
              required: 'Please confirm your new password',
              validate: (v) => v === newPassword || 'Passwords do not match',
            })}
          />
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating…' : 'Update Password'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
