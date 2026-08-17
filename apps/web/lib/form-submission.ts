export type ResettableForm = { reset: () => void };

export async function submitAndReset<T>(form: ResettableForm, submit: () => Promise<T>) {
  const result = await submit();
  form.reset();
  return result;
}
