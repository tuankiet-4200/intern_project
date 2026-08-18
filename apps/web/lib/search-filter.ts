export function shouldResetSubmittedSearch(nextInput: string, submittedSearch: string) {
  return nextInput.trim().length === 0 && submittedSearch.trim().length > 0;
}
