import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export enum ChatView {
  CUSTOMER = 'CUSTOMER',
  SHOP = 'SHOP',
}

export class StartConversationDto {
  @IsUUID()
  shopId!: string;
}

export class ChatConversationQueryDto {
  @IsEnum(ChatView)
  view: ChatView = ChatView.CUSTOMER;
}

export class ChatMessageQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

export class SendChatMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @IsUUID()
  clientMessageId!: string;
}

export class UpdateShopAiDto {
  @IsBoolean()
  enabled!: boolean;
}
