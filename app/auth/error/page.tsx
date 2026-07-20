import { AuthGate } from "@/app/_components/auth-gate";

export default function AuthErrorPage() {
  return <AuthGate message="로그인을 완료하지 못했어요. 다시 시도해 주세요." />;
}
