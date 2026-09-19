import { ArrowUpFromLine } from 'lucide-react'
import { AmountForm, type SubmitResult } from '../components/MoneyForm'
import { PageHeader } from '../components/ui'
import { transactionApi } from '../lib/api'
import { addActivity, statusFromMessage } from '../lib/activity'

export function Withdraw() {
  const handleWithdraw = async (amount: number): Promise<SubmitResult> => {
    const response = await transactionApi.withdraw(amount)
    const status = statusFromMessage(response.msg)
    addActivity({
      type: 'withdraw',
      amount: String(amount),
      currency: 'NPR',
      status,
      note: status === 'success' ? 'Withdrawal completed' : 'Withdrawal rejected by gateway',
    })
    return { message: response.msg, status }
  }

  return (
    <div>
      <PageHeader
        title="Withdraw"
        subtitle="Move money out of your wallet into a bank account."
      />
      <AmountForm
        icon={<ArrowUpFromLine className="h-4 w-4" />}
        title="Withdraw money"
        subtitle="The API checks your balance before processing."
        submitLabel="Withdraw"
        hint="You can't withdraw more than your available balance."
        onSubmit={handleWithdraw}
      />
    </div>
  )
}