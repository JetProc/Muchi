export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

export type NicknameValidation =
  | { ok: true; nickname: string }
  | { ok: false; message: string };

export function normalizeNickname(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validateNickname(value: string): NicknameValidation {
  const nickname = normalizeNickname(value);
  const length = Array.from(nickname).length;
  if (length < NICKNAME_MIN_LENGTH || length > NICKNAME_MAX_LENGTH) {
    return { ok: false, message: `닉네임은 ${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자로 입력해 주세요.` };
  }
  if (!/^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9 ]+$/u.test(nickname)) {
    return { ok: false, message: "한글, 영문, 숫자와 한 칸 띄어쓰기만 사용할 수 있어요." };
  }
  return { ok: true, nickname };
}
