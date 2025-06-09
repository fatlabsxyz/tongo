import React, { useState, useEffect, useCallback } from 'react';
import { RpcProvider, Account, Contract, constants, num, RPC, Call } from 'starknet';
import { tongoAbi } from 'tongo-sdk/dist/tongo.abi.js';
import { Account as TongoAccount } from 'tongo-sdk/dist/account.js';

// --- SDK Configuration ---
const provider = new RpcProvider({
	nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/PiKz_tYh4jYh5FF6rNpZYyWqf1tgsLaP",
	specVersion: "0.8",
});

function deployerWallet(provider: RpcProvider): Account {
	const address = "0x053b8e0fbb59e26519aae59228b401b45f2a35ce5a19650257d7e0011801236f";
	const privateKey = "0x2a249147c54b0d77050414979a4d47499711ef8d46ba314eef12c42093bf068";

	return new Account(provider, address, privateKey, undefined, constants.TRANSACTION_VERSION.V3);
}

const tx_context = {
	version: 3,
	feeDataAvailabilityMode: RPC.EDataAvailabilityMode.L1,
	resourceBounds: {
		l2_gas: {
			max_amount: num.toHex(880000n),
			max_price_per_unit: num.toHex(7586735771n),
		},
		l1_gas: {
			max_amount: num.toHex(2000000n),
			max_price_per_unit: num.toHex(29265098117973n),
		},
		l1_data_gas: {
			max_amount: num.toHex(2000000n),
			max_price_per_unit: num.toHex(150430616388n),
		},
	},
};

const wallet = deployerWallet(provider);
const tongoAddress = "0x00317a359435ffd3c9b30ad0233c017848334a846e764d21fc01313f36d69097"
export const Tongo = new Contract(tongoAbi, tongoAddress, wallet).typedv2(tongoAbi);

async function waitForTxWithLogs(provider: RpcProvider, txHash: string): Promise<any> {
	console.log(`Waiting for transaction: ${txHash}`);
	try {
		const receipt = await provider.waitForTransaction(txHash);
		console.log(`Transaction confirmed: ${txHash}`);
		return receipt;
	} catch (err) {
		console.error(`Transaction failed or timed out: ${txHash}`, err);
		throw err;
	}
}

const App: React.FC = () => {
	const account1Sk = 82130983n;
	const account2Sk = 12930923n;
	const account_1 = new TongoAccount(account1Sk, tongoAddress, provider);
	const account_2 = new TongoAccount(account2Sk, tongoAddress, provider);

	const [accountTab, setAccountTab] = useState<'account' | 'fund' | 'transfer' | 'withdraw'>('account');

	const [fundAmount, setFundAmount] = useState<string>('10');
	const [fundTarget, setFundTarget] = useState<'account1' | 'account2'>('account1');

	const [transferAmount, setTransferAmount] = useState<string>('5');

	const [transferSender, setTransferSender] = useState<'account1' | 'account2'>('account1');
	const [transferRecipient, setTransferRecipient] = useState<'account1' | 'account2'>('account2');

	const [rolloverSource, setRolloverSource] = useState<'account1' | 'account2'>('account1');

	const [withdrawAmount, setWithdrawAmount] = useState<string>('3');
	const [withdrawSource, setWithdrawSource] = useState<'account1' | 'account2'>('account1');

	const [account1DecryptedBalance, setAccount1DecryptedBalance] = useState<string>('Loading...');
	const [account1DecryptedPending, setAccount1DecryptedPending] = useState<string>('Loading...');
	const [account2DecryptedBalance, setAccount2DecryptedBalance] = useState<string>('Loading...');
	const [account2DecryptedPending, setAccount2DecryptedPending] = useState<string>('Loading...');

	const [status, setStatus] = useState<string>('');
	const [error, setError] = useState<string>('');

	const [txHash, setTxHash] = useState<string>('');

	const fetchDecryptedBalances = useCallback(async () => {
		try {
			const s1 = await account_1.state();
			const s2 = await account_2.state();
			setAccount1DecryptedBalance(account_1.decryptCipherBalance(s1.balance).toString());
			setAccount1DecryptedPending(account_1.decryptCipherBalance(s1.pending).toString());
			setAccount2DecryptedBalance(account_2.decryptCipherBalance(s2.balance).toString());
			setAccount2DecryptedPending(account_2.decryptCipherBalance(s2.pending).toString());
			setError('');
		} catch (err: any) {
			console.error('Failed to fetch decrypted balances:', err);
			setError(`Failed to fetch balances: ${err.message || 'Unknown error'}`);
			setAccount1DecryptedBalance('Error');
			setAccount1DecryptedPending('Error');
			setAccount2DecryptedBalance('Error');
			setAccount2DecryptedPending('Error');
		}
	}, [account_1, account_2]);

	useEffect(() => {
		fetchDecryptedBalances();
	}, [fetchDecryptedBalances]);

	const executeAndRefresh = async (operation: Call | Call[], successMessage: string) => {
		setStatus('INITIATING TRANSACTION...');
		setError('');
		try {
			const callsToExecute = Array.isArray(operation) ? operation : [operation];
			const response = await wallet.execute(callsToExecute);//, tx_context);
			console.log("TX SENT", response.transaction_hash);
			await waitForTxWithLogs(provider, response.transaction_hash);
			setStatus(`${successMessage} // TX HASH: ${response.transaction_hash}`);
			console.log("TX SUCCESS", response.transaction_hash);
			setTxHash(response.transaction_hash);
			setStatus(`${successMessage}`);
			await fetchDecryptedBalances();
		} catch (err: any) {
			console.error("TX ERROR", err);
			setError(`TRANSACTION FAILED: ${err.message || 'UNKNOWN ERROR'}`);
		}
	};

	const handleRollover = async () => {
		const source = rolloverSource === 'account1' ? account_1 : account_2;
		setStatus(`CONSTRUCTING ROLLOVER FOR ACCOUNT ${rolloverSource === 'account1' ? 'A' : 'B'}...`);
		const op = await source.rollover();
		await executeAndRefresh(op.toCalldata(), `ROLLOVER OK FOR ACCOUNT ${rolloverSource === 'account1' ? 'A' : 'B'}`);
	};

	const handleFund = async () => {
		const recipient = fundTarget === 'account1' ? account_1 : account_2;
		setStatus(`CONSTRUCTING FUND FOR ACCOUNT ${fundTarget === 'account1' ? 'A' : 'B'}...`);
		const op = await recipient.fund({ amount: BigInt(fundAmount) });
		const calls = op.approve ? [op.approve, op.toCalldata()] : [op.toCalldata()];
		await executeAndRefresh(calls, `FUND OK FOR ACCOUNT ${fundTarget === 'account1' ? 'A' : 'B'}`);
	};

	const handleTransfer = async () => {
		const sender = transferSender === 'account1' ? account_1 : account_2;
		const recipient = transferRecipient === 'account1' ? account_1 : account_2;

		if (sender === recipient) {
			setError("Sender and recipient must be different.");
			return;
		}
		setStatus(`CONSTRUCTING TRANSFER FROM ${transferSender === 'account1' ? 'A' : 'B'} TO ${transferSender === 'account1' ? 'B' : 'A'}...`);
		const op = await sender.transfer({ amount: BigInt(transferAmount), to: recipient.publicKey });
		await executeAndRefresh(op.toCalldata(), `TRANSFER OK FROM ${transferSender === 'account1' ? 'A' : 'B'} TO ${transferSender === 'account1' ? 'B' : 'A'}`);
	};

	const handleWithdraw = async () => {
		const source = withdrawSource === 'account1' ? account_1 : account_2;
		setStatus(`CONSTRUCTING WITHDRAW FOR ACCOUNT ${withdrawSource === 'account1' ? 'A' : 'B'}...`);
		const recipientStarknetAddress = 839131273n;
		const op = await source.withdraw({ amount: BigInt(withdrawAmount), to: recipientStarknetAddress });
		await executeAndRefresh(op.toCalldata(), `WITHDRAW OK FOR ACCOUNT ${withdrawSource === 'account1' ? 'A' : 'B'}`);
	};

	const formatPubkey = (key: any) => {
		const x = key?.x?.toString(16);
		if (!x) return 'N/A';
		return `0x${x.slice(0, 6)}...${x.slice(-4)}`;
	};

	const copyToClipboard = (key: any) => {
		navigator.clipboard.writeText(key?.x?.toString(16) || ''); // Copy full hex string
		setStatus('Public Key Copied!'); // Provide feedback
		setTimeout(() => setStatus(''), 2000); // Clear after a delay
	};

	// --- FAT SOLUTIONS Color Palette ---
	const colors = {
		background: '#1E1E1E',
		textPrimary: '#E7E7D8',
		accentRed: '#EA4125',
		textSecondary: '#71717A',
		successGreen: '#00CC00',
	};

	// --- Modern UI Styles ---
	const containerStyle: React.CSSProperties = {
		backgroundColor: colors.background,
		color: colors.textPrimary,
		minHeight: '100vh',
		fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		padding: '0 20px',
	};

	const contentWrapperStyle: React.CSSProperties = {
		maxWidth: '960px', // Wider content area
		width: '100%',
		padding: '40px 0',
	};

	const headerStyle: React.CSSProperties = {
		textAlign: 'center',
		color: colors.accentRed,
		fontSize: '3em', // Larger main header
		fontWeight: 'bold',
		marginBottom: '40px',
		textTransform: 'uppercase',
		borderBottom: `1px solid ${colors.textSecondary}`, // Subtle separator
		paddingBottom: '20px',
	};

	const tabContainerStyle: React.CSSProperties = {
		display: 'flex',
		justifyContent: 'center',
		marginBottom: '40px',
		borderBottom: `1px solid ${colors.textSecondary}`, // Underline for tabs
		paddingBottom: '10px',
	};

	const tabButtonStyle = (active: boolean): React.CSSProperties => ({
		background: 'none', // No background for inactive tabs
		border: 'none',
		color: active ? colors.accentRed : colors.textPrimary,
		padding: '10px 20px',
		fontSize: '1.1em',
		cursor: 'pointer',
		fontWeight: active ? 'bold' : 'normal',
		position: 'relative',
		transition: 'color 0.2s ease, transform 0.1s ease',
		textTransform: 'uppercase',
	});

	const tabButtonHoverActiveStyle: React.CSSProperties = {
		color: colors.accentRed,
		transform: 'translateY(-2px)', // Subtle lift on hover
	};

	const sectionTitleStyle: React.CSSProperties = {
		color: colors.accentRed,
		fontSize: '1.8em', // Slightly smaller for sections
		fontWeight: 'bold',
		marginBottom: '30px',
		textTransform: 'uppercase',
		borderBottom: `1px solid ${colors.textSecondary}`, // Section title separator
		paddingBottom: '15px',
	};

	const subSectionTitleStyle: React.CSSProperties = {
		color: colors.textPrimary,
		fontSize: '1.3em',
		fontWeight: 'bold',
		marginBottom: '20px',
		marginTop: '30px',
	};

	const accountDetailTextStyle: React.CSSProperties = {
		fontFamily: '"Fira Code", "Consolas", "Courier New", monospace', // Monospace for technical data
		fontSize: '1em',
		marginBottom: '8px',
		lineHeight: '1.5',
	};

	const accountDetailLabelStyle: React.CSSProperties = {
		color: colors.textSecondary,
		fontWeight: 'normal', // Labels are less bold than values
	};

	const inputGroupStyle: React.CSSProperties = {
		marginBottom: '30px',
	};

	const labelStyle: React.CSSProperties = {
		display: 'block',
		marginBottom: '10px',
		color: colors.textPrimary,
		fontSize: '1em',
		fontWeight: 'bold',
	};

	const inputStyle: React.CSSProperties = {
		width: 'calc(100% - 24px)', // Account for padding
		padding: '12px',
		marginBottom: '20px',
		backgroundColor: colors.background,
		border: `1px solid ${colors.textSecondary}`, // Subtle grey border
		color: colors.textPrimary,
		fontSize: '1em',
		outline: 'none',
		transition: 'border-color 0.2s ease',
	};

	const inputFocusStyle: React.CSSProperties = {
		borderColor: colors.accentRed, // Red border on focus
	};

	const selectStyle: React.CSSProperties = {
		...inputStyle, // Inherit base input styles
		appearance: 'none', // Remove default dropdown arrow
		paddingRight: '30px', // Make space for custom arrow if needed
		backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23${colors.textPrimary.substring(1)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
		backgroundRepeat: 'no-repeat',
		backgroundPosition: 'right 10px center',
		backgroundSize: '16px',
	};

	const buttonStyle: React.CSSProperties = {
		padding: '14px 30px',
		backgroundColor: colors.accentRed,
		color: colors.background, // Black text on red for contrast
		border: 'none',
		cursor: 'pointer',
		fontSize: '1.1em',
		fontWeight: 'bold',
		textTransform: 'uppercase',
		transition: 'background-color 0.2s ease, transform 0.1s ease',
		borderRadius: '4px', // Slightly rounded corners for modern feel
		width: '100%', // Full width for primary actions
	};

	const secondaryButtonStyle: React.CSSProperties = {
		...buttonStyle,
		backgroundColor: colors.textSecondary, // Grey background for secondary actions
		color: colors.textPrimary,
		marginTop: '30px',
	};

	const statusBoxStyle: React.CSSProperties = {
		position: 'fixed',
		bottom: '20px',
		left: '50%',
		transform: 'translateX(-50%)',
		padding: '15px 25px',
		backgroundColor: error ? `${colors.accentRed}1A` : `${colors.successGreen}1A`, // Subtle background
		color: error ? colors.accentRed : colors.successGreen,
		fontFamily: '"Fira Code", "Consolas", "Courier New", monospace',
		fontSize: '0.9em',
		borderRadius: '8px',
		maxWidth: 'calc(100% - 40px)', // Account for page padding
		textAlign: 'center',
		wordBreak: 'break-all',
		zIndex: 9999,
		border: `1px solid ${error ? colors.accentRed : colors.successGreen}`,
	};

	const infoTextStyle: React.CSSProperties = {
		fontSize: '0.9em',
		color: colors.textSecondary,
		marginBottom: '20px',
		lineHeight: '1.4',
	};

	const listStyle: React.CSSProperties = {
		listStyleType: 'none',
		paddingLeft: '0',
	};

	const listItemStyle: React.CSSProperties = {
		marginBottom: '10px',
		color: colors.textSecondary,
		position: 'relative',
		paddingLeft: '20px',
	};

	const listItemBulletStyle: React.CSSProperties = {
		content: '"\\2022"', // Unicode bullet
		color: colors.accentRed,
		position: 'absolute',
		left: '0',
	};


	return (
		<div style={containerStyle}>
			<div style={contentWrapperStyle}>
				<h1 style={headerStyle}>TONGO protocol</h1>

				<div style={tabContainerStyle}>
					<button
						onClick={() => setAccountTab('account')}
						style={tabButtonStyle(accountTab === 'account')}
						onMouseEnter={(e) => Object.assign(e.currentTarget.style, tabButtonHoverActiveStyle)}
						onMouseLeave={(e) => Object.assign(e.currentTarget.style, tabButtonStyle(accountTab === 'account'))}
					>
						Account
					</button>
					<button
						onClick={() => setAccountTab('fund')}
						style={tabButtonStyle(accountTab === 'fund')}
						onMouseEnter={(e) => Object.assign(e.currentTarget.style, tabButtonHoverActiveStyle)}
						onMouseLeave={(e) => Object.assign(e.currentTarget.style, tabButtonStyle(accountTab === 'fund'))}
					>
						Fund
					</button>
					<button
						onClick={() => setAccountTab('transfer')}
						style={tabButtonStyle(accountTab === 'transfer')}
						onMouseEnter={(e) => Object.assign(e.currentTarget.style, tabButtonHoverActiveStyle)}
						onMouseLeave={(e) => Object.assign(e.currentTarget.style, tabButtonStyle(accountTab === 'transfer'))}
					>
						Transfer
					</button>
					<button
						onClick={() => setAccountTab('withdraw')}
						style={tabButtonStyle(accountTab === 'withdraw')}
						onMouseEnter={(e) => Object.assign(e.currentTarget.style, tabButtonHoverActiveStyle)}
						onMouseLeave={(e) => Object.assign(e.currentTarget.style, tabButtonStyle(accountTab === 'withdraw'))}
					>
						Withdraw
					</button>
				</div>

				{/* Account Balances Tab */}
				{accountTab === 'account' && (
					<div>
						<h2 style={sectionTitleStyle}>ACCOUNT BALANCES</h2>
						<div style={{ marginBottom: '40px' }}>
							<h3 style={subSectionTitleStyle}>ACCOUNT A</h3>
							<p style={accountDetailTextStyle}>
								<strong style={accountDetailLabelStyle}>PUBLIC KEY:</strong>{' '}
								<span onClick={() => copyToClipboard(account_1.publicKey)} style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: colors.textSecondary }}>
									{formatPubkey(account_1.publicKey)}
								</span>
							</p>
							<p style={accountDetailTextStyle}><strong style={accountDetailLabelStyle}>BALANCE:</strong> {account1DecryptedBalance}</p>
							<p style={accountDetailTextStyle}><strong style={accountDetailLabelStyle}>PENDING:</strong> {account1DecryptedPending}</p>

							<h3 style={subSectionTitleStyle}>ACCOUNT B</h3>
							<p style={accountDetailTextStyle}>
								<strong style={accountDetailLabelStyle}>PUBLIC KEY:</strong>{' '}
								<span onClick={() => copyToClipboard(account_2.publicKey)} style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: colors.textSecondary }}>
									{formatPubkey(account_2.publicKey)}
								</span>
							</p>
							<p style={accountDetailTextStyle}><strong style={accountDetailLabelStyle}>BALANCE:</strong> {account2DecryptedBalance}</p>
							<p style={accountDetailTextStyle}><strong style={accountDetailLabelStyle}>PENDING:</strong> {account2DecryptedPending}</p>

							<button
								onClick={fetchDecryptedBalances}
								style={secondaryButtonStyle}
								onMouseEnter={(e) => Object.assign(e.currentTarget.style, { ...secondaryButtonStyle, backgroundColor: '#8A8A91', transform: 'translateY(-1px)' })}
								onMouseLeave={(e) => Object.assign(e.currentTarget.style, secondaryButtonStyle)}
							>
								REFRESH BALANCES
							</button>
						</div>

						{/* Rollover action integrated here */}
						<div style={{ paddingTop: '30px', borderTop: `1px solid ${colors.textSecondary}` }}>
							<h3 style={subSectionTitleStyle}>ROLLOVER PENDING FUNDS</h3>
							<div style={inputGroupStyle}>
								<label style={labelStyle}>SELECT ACCOUNT:</label>
								<select style={selectStyle} value={rolloverSource} onChange={(e) => setRolloverSource(e.target.value as any)}>
									<option value="account1">ACCOUNT A</option>
									<option value="account2">ACCOUNT B</option>
								</select>
								<p style={infoTextStyle}>MOVES PENDING FUNDS INTO THE MAIN ACCOUNT BALANCE.</p>
								<button
									onClick={handleRollover}
									style={buttonStyle}
									onMouseEnter={(e) => Object.assign(e.currentTarget.style, { ...buttonStyle, backgroundColor: '#FF6655', transform: 'translateY(-1px)' })}
									onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
								>
									EXECUTE ROLLOVER
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Fund Tab */}
				{accountTab === 'fund' && (
					<div>
						<h2 style={sectionTitleStyle}>FUND ACCOUNT</h2>
						<div style={inputGroupStyle}>
							<label style={labelStyle}>ACCOUNT TO FUND:</label>
							<select style={selectStyle} value={fundTarget} onChange={(e) => setFundTarget(e.target.value as any)}>
								<option value="account1">ACCOUNT A</option>
								<option value="account2">ACCOUNT B</option>
							</select>
						</div>
						<div style={inputGroupStyle}>
							<label style={labelStyle}>AMOUNT (BIGINT):</label>
							<input
								type="number"
								value={fundAmount}
								onChange={(e) => setFundAmount(e.target.value)}
								style={inputStyle}
								onFocus={(e) => Object.assign(e.currentTarget.style, inputFocusStyle)}
								onBlur={(e) => Object.assign(e.currentTarget.style, inputStyle)}
							/>
						</div>
						<button
							onClick={handleFund}
							style={buttonStyle}
							onMouseEnter={(e) => Object.assign(e.currentTarget.style, { ...buttonStyle, backgroundColor: '#FF6655', transform: 'translateY(-1px)' })}
							onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
						>
							INITIATE FUND
						</button>
					</div>
				)}

				{accountTab === 'transfer' && (
					<div>
						<h2 style={sectionTitleStyle}>TRANSFER FUNDS</h2>
						<div style={inputGroupStyle}>
							<label style={labelStyle}>SENDER ACCOUNT:</label>
							<select style={selectStyle} value={transferSender} onChange={(e) => setTransferSender(e.target.value as any)}>
								<option value="account1">ACCOUNT A</option>
								<option value="account2">ACCOUNT B</option>
							</select>
						</div>
						<div style={inputGroupStyle}>
							<label style={labelStyle}>RECIPIENT ACCOUNT:</label>
							<select style={selectStyle} value={transferRecipient} onChange={(e) => setTransferRecipient(e.target.value as any)}>
								<option value="account1">ACCOUNT A</option>
								<option value="account2">ACCOUNT B</option>
							</select>
						</div>
						<div style={inputGroupStyle}>
							<label style={labelStyle}>AMOUNT (BIGINT):</label>
							<input
								type="number"
								value={transferAmount}
								onChange={(e) => setTransferAmount(e.target.value)}
								style={inputStyle}
								onFocus={(e) => Object.assign(e.currentTarget.style, inputFocusStyle)}
								onBlur={(e) => Object.assign(e.currentTarget.style, inputStyle)}
							/>
						</div>
						<button
							onClick={handleTransfer}
							style={buttonStyle}
							onMouseEnter={(e) => Object.assign(e.currentTarget.style, { ...buttonStyle, backgroundColor: '#FF6655', transform: 'translateY(-1px)' })}
							onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
						>
							EXECUTE TRANSFER
						</button>
					</div>
				)}

				{/* Withdraw Tab */}
				{accountTab === 'withdraw' && (
					<div>
						<h2 style={sectionTitleStyle}>WITHDRAW FUNDS</h2>
						<div style={inputGroupStyle}>
							<label style={labelStyle}>ACCOUNT TO WITHDRAW FROM:</label>
							<select style={selectStyle} value={withdrawSource} onChange={(e) => setWithdrawSource(e.target.value as any)}>
								<option value="account1">ACCOUNT A</option>
								<option value="account2">ACCOUNT B</option>
							</select>
						</div>
						<div style={inputGroupStyle}>
							<label style={labelStyle}>AMOUNT (BIGINT):</label>
							<input
								type="number"
								value={withdrawAmount}
								onChange={(e) => setWithdrawAmount(e.target.value)}
								style={inputStyle}
								onFocus={(e) => Object.assign(e.currentTarget.style, inputFocusStyle)}
								onBlur={(e) => Object.assign(e.currentTarget.style, inputStyle)}
							/>
						</div>
						<p style={infoTextStyle}>FUNDS WILL BE WITHDRAWN TO A PRE-DEFINED STARKNET ADDRESS: 0X839131273N</p>
						<button
							onClick={handleWithdraw}
							style={buttonStyle}
							onMouseEnter={(e) => Object.assign(e.currentTarget.style, { ...buttonStyle, backgroundColor: '#FF6655', transform: 'translateY(-1px)' })}
							onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
						>
							EXECUTE WITHDRAW
						</button>
					</div>
				)}
			</div>

			{(status || error) && (
				<div style={statusBoxStyle}>
					{error ? (
						<>ERROR: {error}</>
					) : (
						<>
							STATUS: {status}
							{txHash && (
								<>
									{' // '}
									<a
										href={`https://sepolia.starkscan.co/tx/${txHash}`}
										target="_blank"
										rel="noopener noreferrer"
										style={{ color: colors.successGreen, textDecoration: 'underline' }}
									>
										View on StarkScan
									</a>
								</>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
};

export default App;
