import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Button, Input } from '../components/ui/index.jsx'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
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

  if (user) return <Navigate to="/dashboard" replace />

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
            navigate(location.state?.from || '/dashboard', { replace: true })
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
