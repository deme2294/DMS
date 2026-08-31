import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { registerTenant } from '../../api/tenantApi';
import type { TenantRegisterValues } from '../../types/tenant';
import styles from './Auth.module.css';

export default function TenantRegister() {
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<TenantRegisterValues>();

  const onSubmit = async (values: TenantRegisterValues) => {
    await registerTenant({
      organizationName: values.organizationName,
      registrationNumber: values.registrationNumber,
      contactPerson: values.contactPerson,
      email: values.email,
      phone: values.phone,
      address: values.address,
      username: values.username,
      password: values.password,
    });
    navigate('/login', { state: { message: 'Registration submitted. Wait for admin approval.' } });
  };

  return (
    <div className={styles.wrapper}>
      <form className={styles.card} onSubmit={handleSubmit(onSubmit)}>
        <h1>Tenant Registration</h1>
        <p className={styles.subtitle}>Register your organization for help desk services.</p>

        <input placeholder="Organization Name" {...register('organizationName', { required: true })} />
        <input placeholder="Registration Number" {...register('registrationNumber')} />
        <input placeholder="Contact Person" {...register('contactPerson', { required: true })} />
        <input type="email" placeholder="Organization Email" {...register('email', { required: true })} />
        <input placeholder="Phone" {...register('phone')} />
        <textarea placeholder="Address" rows={3} {...register('address')} />
        <input placeholder="Login Username" {...register('username', { required: true, minLength: 3 })} />
        <input type="password" placeholder="Password" {...register('password', { required: true, minLength: 8 })} />
        <input
          type="password"
          placeholder="Confirm Password"
          {...register('confirmPassword', {
            required: true,
            validate: (val) => val === watch('password') || 'Passwords do not match',
          })}
        />
        {errors.confirmPassword && <span className={styles.error}>{errors.confirmPassword.message}</span>}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Register'}
        </button>

        <p className={styles.footer}>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}