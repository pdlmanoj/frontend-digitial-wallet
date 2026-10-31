import { ArrowDownToLine } from 'lucide-react'
import { AmountForm, type SubmitResult } from '../components/MoneyForm'
import { PageHeader } from '../components/ui'
import { transactionApi } from '../lib/api'
import { statusFromMessage } from '../lib/format'

export function Deposit() {
  const handleDeposit = async (amount: number): Promise<SubmitResult> => {
    const response = await transactionApi.deposit(amount)
    const status = statusFromMessage(response.msg)
    return { message: response.msg, status }
  }

  return (
    <div>
      <PageHeader
        title="Deposit"
        subtitle="Add money to your wallet. This is a simulated payment gateway."
      />
      <AmountForm
        icon={<ArrowDownToLine className="h-4 w-4" />}
        title="Deposit money"
        subtitle="The gateway randomly approves or rejects the deposit."
        submitLabel="Deposit"
        hint="Minimum deposit is 1 NPR."
        onSubmit={handleDeposit}
      />
    </div>
  )
}