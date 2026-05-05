import PublishChannelBaseModal, { type PublishWhatsAppModalProps } from './PublishChannelBaseModal';

type Props = Omit<PublishWhatsAppModalProps, 'forcedChannel'>;

export default function PublishPushChannelModal(props: Props) {
  return <PublishChannelBaseModal {...props} forcedChannel="push" />;
}
