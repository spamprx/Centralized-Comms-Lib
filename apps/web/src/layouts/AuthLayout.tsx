import Slot from "../components/ui/Slot";

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <Slot name="LogoHeader" className="h-16 w-full" />
        <Slot name="LoginCard" className="min-h-[20rem] w-full space-y-4 p-6">
          <Slot name="LoginForm" className="h-12 w-full" />
          <Slot name="EmailInput" className="h-10 w-full" />
          <Slot name="PasswordInput" className="h-10 w-full" />
          <Slot name="RememberMeCheckbox" className="h-6 w-24" />
          <Slot name="LoginButton" className="h-10 w-full" />
          <Slot name="ForgotPasswordLink" className="h-10 w-full" />
          <Slot name="SignupRedirectLink" className="h-10 w-full" />
        </Slot>
        <Slot name="SSOOptions" className="h-8 w-full" />
        <Slot name="FooterLinks" className="h-6 w-full" />
      </div>
    </div>
  );
}
