import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Button, Input } from '../components/ui/index.jsx'

function MfaChallengeForm() {
  const { verifyMfa, logout } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { code: '' } })

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-[420px] max-w-full rounded-panel border border-border-subtle bg-surface shadow-panel p-6">
        <div className="text-center">
          <div className="text-[20px] font-semibold text-accent">Optom Capital</div>
          <div className="mt-1 text-[13px] text-text-secondary">Two-factor verification</div>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={handleSubmit(async (values) => {
            try {
              await verifyMfa(String(values.code || '').trim())
            } catch {
              // toast already shown by context; navigation happens reactively once mfaPending clears
            }
          })}
        >
          <Input
            label="Authenticator Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            error={errors.code?.message}
            {...register('code', { required: 'Enter the 6-digit code from your authenticator app' })}
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            Verify
          </Button>
          <button
            type="button"
            className="w-full text-center text-[12px] text-text-secondary hover:text-text-primary"
            onClick={() => logout()}
          >
            Back to sign in
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Login() {
  const { user, mfaPending, login } = useAuth()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
  })

  if (user && mfaPending) return <MfaChallengeForm />
  if (user) return <Navigate to={location.state?.from || '/dashboard'} replace />

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-[420px] max-w-full rounded-panel border border-border-subtle bg-surface shadow-panel p-6">
        <div className="text-center">
          <div className="text-[20px] font-semibold text-accent">Optom Capital</div>
          <div className="mt-1 text-[13px] text-text-secondary">Loan CRM</div>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={handleSubmit(async (values) => {
            await login(values.email, values.password)
          })}
        >
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email', { required: 'Email is required' })}
          />

          <div className="w-full">
            <div className="mb-1 text-[12px] font-medium text-text-secondary">Password</div>
            <div className="relative">
              <input
                className={[
                  'h-[34px] w-full rounded-md border border-border-input bg-surface px-3 pr-10 text-[13px] outline-none focus:border-accent',
                  errors.password ? 'border-danger focus:border-danger' : '',
                ].join(' ')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password', { required: 'Password is required' })}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password ? <div className="mt-1 text-[12px] text-danger">{errors.password.message}</div> : null}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            Sign In
          </Button>
        </form>
      </div>
    </div>
  )
}
