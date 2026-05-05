import PublishChannelBaseModal, { type PublishWhatsAppModalProps } from './PublishChannelBaseModal';

type Props = Omit<PublishWhatsAppModalProps, 'forcedChannel'>;

export default function PublishEmailChannelModal(props: Props) {
  return <PublishChannelBaseModal {...props} forcedChannel="email" />;
}
