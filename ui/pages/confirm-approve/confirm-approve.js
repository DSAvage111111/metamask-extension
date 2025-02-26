import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import ConfirmTransactionBase from '../confirm-transaction-base';
import { EDIT_GAS_MODES } from '../../../shared/constants/gas';
import {
  showModal,
  updateCustomNonce,
  getNextNonce,
} from '../../store/actions';
import { getTokenData } from '../../helpers/utils/transactions.util';
import {
  calcTokenAmount,
  getTokenAddressParam,
  getTokenValueParam,
} from '../../helpers/utils/token-util';
import { readAddressAsContract } from '../../../shared/modules/contract-utils';
import { useTokenTracker } from '../../hooks/useTokenTracker';
import {
  getTokens,
  getNativeCurrency,
  isAddressLedger,
} from '../../ducks/metamask/metamask';
import {
  transactionFeeSelector,
  txDataSelector,
  getCurrentCurrency,
  getDomainMetadata,
  getUseNonceField,
  getCustomNonceValue,
  getNextSuggestedNonce,
  getCurrentChainId,
  getRpcPrefsForCurrentProvider,
} from '../../selectors';

import { useApproveTransaction } from '../../hooks/useApproveTransaction';

import { currentNetworkTxListSelector } from '../../selectors/transactions';
import Loading from '../../components/ui/loading-screen';
import EditGasPopover from '../../components/app/edit-gas-popover/edit-gas-popover.component';
import { isEqualCaseInsensitive } from '../../helpers/utils/util';
import { getCustomTxParamsData } from './confirm-approve.util';
import ConfirmApproveContent from './confirm-approve-content';

const isAddressLedgerByFromAddress = (address) => (state) => {
  return isAddressLedger(state, address);
};

export default function ConfirmApprove() {
  const dispatch = useDispatch();
  const { id: paramsTransactionId } = useParams();
  const {
    id: transactionId,
    txParams: { to: tokenAddress, data, from } = {},
  } = useSelector(txDataSelector);

  const currentCurrency = useSelector(getCurrentCurrency);
  const nativeCurrency = useSelector(getNativeCurrency);
  const currentNetworkTxList = useSelector(currentNetworkTxListSelector);
  const domainMetadata = useSelector(getDomainMetadata);
  const tokens = useSelector(getTokens);
  const useNonceField = useSelector(getUseNonceField);
  const nextNonce = useSelector(getNextSuggestedNonce);
  const customNonceValue = useSelector(getCustomNonceValue);
  const chainId = useSelector(getCurrentChainId);
  const rpcPrefs = useSelector(getRpcPrefsForCurrentProvider);

  const fromAddressIsLedger = useSelector(isAddressLedgerByFromAddress(from));

  const transaction =
    currentNetworkTxList.find(
      ({ id }) => id === (Number(paramsTransactionId) || transactionId),
    ) || {};
  const { ethTransactionTotal, fiatTransactionTotal } = useSelector((state) =>
    transactionFeeSelector(state, transaction),
  );

  const currentToken = (tokens &&
    tokens.find(({ address }) =>
      isEqualCaseInsensitive(tokenAddress, address),
    )) || {
    address: tokenAddress,
  };

  const { tokensWithBalances } = useTokenTracker([currentToken]);
  const tokenTrackerBalance = tokensWithBalances[0]?.balance || '';

  const tokenSymbol = currentToken?.symbol;
  const decimals = Number(currentToken?.decimals);
  const tokenImage = currentToken?.image;
  const tokenData = getTokenData(data);
  const tokenValue = getTokenValueParam(tokenData);
  const toAddress = getTokenAddressParam(tokenData);
  const tokenAmount =
    tokenData && calcTokenAmount(tokenValue, decimals).toString(10);

  const [customPermissionAmount, setCustomPermissionAmount] = useState('');

  const previousTokenAmount = useRef(tokenAmount);

  const {
    approveTransaction,
    showCustomizeGasPopover,
    closeCustomizeGasPopover,
  } = useApproveTransaction();

  useEffect(() => {
    if (customPermissionAmount && previousTokenAmount.current !== tokenAmount) {
      setCustomPermissionAmount(tokenAmount);
    }
    previousTokenAmount.current = tokenAmount;
  }, [customPermissionAmount, tokenAmount]);

  const [submitWarning, setSubmitWarning] = useState('');
  const prevNonce = useRef(nextNonce);
  const prevCustomNonce = useRef(customNonceValue);
  useEffect(() => {
    if (
      prevNonce.current !== nextNonce ||
      prevCustomNonce.current !== customNonceValue
    ) {
      if (nextNonce !== null && customNonceValue > nextNonce) {
        setSubmitWarning(
          `Nonce is higher than suggested nonce of ${nextNonce}`,
        );
      } else {
        setSubmitWarning('');
      }
    }
    prevCustomNonce.current = customNonceValue;
    prevNonce.current = nextNonce;
  }, [customNonceValue, nextNonce]);

  const [isContract, setIsContract] = useState(false);
  const checkIfContract = useCallback(async () => {
    const { isContractAddress } = await readAddressAsContract(
      global.eth,
      toAddress,
    );
    setIsContract(isContractAddress);
  }, [setIsContract, toAddress]);
  useEffect(() => {
    checkIfContract();
  }, [checkIfContract]);

  const { origin } = transaction;
  const formattedOrigin = origin || '';

  const { icon: siteImage = '' } = domainMetadata[origin] || {};

  const tokensText = `${Number(tokenAmount)} ${tokenSymbol}`;
  const tokenBalance = tokenTrackerBalance
    ? calcTokenAmount(tokenTrackerBalance, decimals).toString(10)
    : '';
  const customData = customPermissionAmount
    ? getCustomTxParamsData(data, { customPermissionAmount, decimals })
    : null;

  return tokenSymbol === undefined ? (
    <Loading />
  ) : (
    <ConfirmTransactionBase
      toAddress={toAddress}
      identiconAddress={tokenAddress}
      showAccountInHeader
      title={tokensText}
      contentComponent={
        <>
          <ConfirmApproveContent
            decimals={decimals}
            siteImage={siteImage}
            setCustomAmount={setCustomPermissionAmount}
            customTokenAmount={String(customPermissionAmount)}
            tokenAmount={tokenAmount}
            origin={formattedOrigin}
            tokenSymbol={tokenSymbol}
            tokenImage={tokenImage}
            tokenBalance={tokenBalance}
            showCustomizeGasModal={approveTransaction}
            showEditApprovalPermissionModal={({
              /* eslint-disable no-shadow */
              customTokenAmount,
              decimals,
              origin,
              setCustomAmount,
              tokenAmount,
              tokenBalance,
              tokenSymbol,
              /* eslint-enable no-shadow */
            }) =>
              dispatch(
                showModal({
                  name: 'EDIT_APPROVAL_PERMISSION',
                  customTokenAmount,
                  decimals,
                  origin,
                  setCustomAmount,
                  tokenAmount,
                  tokenBalance,
                  tokenSymbol,
                }),
              )
            }
            data={customData || data}
            toAddress={toAddress}
            currentCurrency={currentCurrency}
            nativeCurrency={nativeCurrency}
            ethTransactionTotal={ethTransactionTotal}
            fiatTransactionTotal={fiatTransactionTotal}
            useNonceField={useNonceField}
            nextNonce={nextNonce}
            customNonceValue={customNonceValue}
            updateCustomNonce={(value) => {
              dispatch(updateCustomNonce(value));
            }}
            getNextNonce={() => dispatch(getNextNonce())}
            showCustomizeNonceModal={({
              /* eslint-disable no-shadow */
              useNonceField,
              nextNonce,
              customNonceValue,
              updateCustomNonce,
              getNextNonce,
              /* eslint-disable no-shadow */
            }) =>
              dispatch(
                showModal({
                  name: 'CUSTOMIZE_NONCE',
                  useNonceField,
                  nextNonce,
                  customNonceValue,
                  updateCustomNonce,
                  getNextNonce,
                }),
              )
            }
            warning={submitWarning}
            txData={transaction}
            fromAddressIsLedger={fromAddressIsLedger}
            chainId={chainId}
            rpcPrefs={rpcPrefs}
            isContract={isContract}
          />
          {showCustomizeGasPopover && (
            <EditGasPopover
              onClose={closeCustomizeGasPopover}
              mode={EDIT_GAS_MODES.MODIFY_IN_PLACE}
              transaction={transaction}
            />
          )}
        </>
      }
      hideSenderToRecipient
      customTxParamsData={customData}
    />
  );
}
