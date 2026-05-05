import PublishChannelBaseModal, { type PublishWhatsAppModalProps } from './PublishChannelBaseModal';

type Props = Omit<PublishWhatsAppModalProps, 'forcedChannel'>;

export default function PublishWhatsAppChannelModal(props: Props) {
  return <PublishChannelBaseModal {...props} forcedChannel="whatsapp" />;
}
