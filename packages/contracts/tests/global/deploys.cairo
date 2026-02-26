use core::ec::{NonZeroEcPoint, EcPointTrait};

use tongo::tongo::IGlobal::IGlobalDispatcherTrait;
use tongo::tongo::ILedger::{ILedgerDispatcher, ILedgerDispatcherTrait};

use crate::global::setup::setup_global;
use crate::consts::{OWNER_ADDRESS, AUDITOR_KEY};

